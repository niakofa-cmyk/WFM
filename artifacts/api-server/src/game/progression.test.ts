import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import { WebSocket } from "ws";
import {
  db,
  playerProgressTable,
  progressionEventsTable,
  pool,
  strikeRunsTable,
} from "@workspace/db";
import {
  ApplyProgressionActionBody,
  ClaimStrikeBody,
  StartStrikeBody,
} from "@workspace/api-zod";
import {
  applyPlayerAction,
  claimPlayerStrike,
  getPlayerProfile,
  ProgressionError,
  startPlayerStrike,
} from "./progression";
import {
  adjudicateStrike,
  PRACTICE_STEP_LIMIT,
  STRIKE_STEP_LIMIT,
  validateStrikeReplayInputs,
  type ReplayClaim,
} from "./rewards";
import { startWingSocketServer } from "../socket/server";
import { authenticateTestSocket, createSocketTestAuth } from "../socket/test-session-auth";
import { StrikeRunIdParams } from "../routes/strikes";

type SocketTestPacket = { type?: string; [key: string]: unknown };
const socketTestAuth = createSocketTestAuth();

function waitForSocketPacket(
  socket: WebSocket,
  matches: (packet: SocketTestPacket) => boolean,
  timeoutMs = 3_000,
) {
  return new Promise<SocketTestPacket>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for the expected room packet."));
    }, timeoutMs);
    const onMessage = (data: Buffer) => {
      let packet: SocketTestPacket;
      try {
        packet = JSON.parse(data.toString()) as SocketTestPacket;
      } catch {
        return;
      }
      if (!matches(packet)) return;
      clearTimeout(timer);
      socket.off("message", onMessage);
      resolve(packet);
    };
    socket.on("message", onMessage);
  });
}

async function openTestSocket(url: string, playerId: string) {
  const socket = await new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
  await authenticateTestSocket(socket, socketTestAuth, playerId);
  return socket;
}

function closeTestSocket(socket: WebSocket) {
  if (socket.readyState === WebSocket.CLOSED) return Promise.resolve();
  return new Promise<void>((resolve) => {
    socket.once("close", () => resolve());
    socket.close();
  });
}

test("strike replay validation enforces frame limits, strict input shapes, and pulse transitions", () => {
  const idle = {
    throttle: 0,
    yaw: 0,
    strafe: 0,
    pitch: 0,
    fire: false,
    ult: false,
    lock: false,
    evade: 0,
    preset: null,
  };

  assert.doesNotThrow(() => validateStrikeReplayInputs([idle], "practice"));
  assert.throws(
    () => validateStrikeReplayInputs(Array.from({ length: PRACTICE_STEP_LIMIT + 1 }, () => idle), "practice"),
    /maximum frame count/i,
  );
  assert.throws(
    () => validateStrikeReplayInputs(Array.from({ length: STRIKE_STEP_LIMIT + 1 }, () => idle), "strike"),
    /maximum frame count/i,
  );
  assert.throws(
    () => validateStrikeReplayInputs([{ ...idle, extra: true }], "practice"),
    /invalid control input/i,
  );
  assert.throws(
    () => validateStrikeReplayInputs([{ ...idle, yaw: 1.5 }], "practice"),
    /invalid control input/i,
  );
  assert.throws(
    () => validateStrikeReplayInputs([{ ...idle, ult: true }, { ...idle, ult: true }], "practice"),
    /release frame/i,
  );
  assert.throws(
    () => validateStrikeReplayInputs([{ ...idle, evade: 1 }, { ...idle, evade: -1 }], "practice"),
    /release frame/i,
  );
  assert.throws(
    () => validateStrikeReplayInputs([{ ...idle, preset: 1 }, { ...idle, preset: 2 }], "practice"),
    /release frame/i,
  );
});

test("server replay rejects frames after the authoritative match has ended", () => {
  const idle = {
    throttle: 0,
    yaw: 0,
    strafe: 0,
    pitch: 0,
    fire: false,
    ult: false,
    lock: false,
    evade: 0,
    preset: null,
  };
  const claim: ReplayClaim = {
    seed: 1,
    shipId: "mandjet",
    faction: "accord",
    refit: 0,
    pace: "practice",
    goal: "extract",
    disc: "dust",
    allyCount: 3,
    foeCount: 4,
    tech: null,
    inputs: Array.from({ length: 4_147 }, () => idle),
    mission: "cage",
    cleared: 0,
    hold: null,
    paid: 0,
    prices: { salt: 40, iron: 70, dust: 110, resin: 55 },
  };

  assert.throws(() => adjudicateStrike(claim), /after the match ended/i);
});

test("progression request schemas reject client-authored balances and campaign clears", () => {
  assert.equal(
    StartStrikeBody.strict().safeParse({
      shipId: "mandjet",
      faction: "accord",
      scheme: "arc",
      pace: "strike",
      mission: "contact",
      tech: null,
      credits: 9_999_999,
      cleared: 4,
      seed: 123,
    }).success,
    false,
  );
  assert.equal(
    ClaimStrikeBody.strict().safeParse({ inputs: [], gain: 9_999_999, cleared: 4 }).success,
    false,
  );
  assert.equal(
    ClaimStrikeBody.strict().safeParse({
      inputs: [],
      strikeRunId: randomUUID(),
      reconnectToken: "client-supplied",
      clientRecordedLoot: 9_999_999,
    }).success,
    false,
  );
  assert.equal(
    ApplyProgressionActionBody.strict().safeParse({
      idempotencyKey: randomUUID(),
      action: "refit",
      credits: 9_999_999,
      refit: 5,
    }).success,
    false,
  );
});

test(
  "player profiles and strike claims are isolated by user id",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const firstUser = `test_isolation_${randomUUID()}`;
    const secondUser = `test_isolation_${randomUUID()}`;
    const selection = {
      shipId: "mandjet",
      faction: "accord",
      scheme: "arc",
      pace: "practice",
      mission: "contact",
      tech: null,
    } as const;

    try {
      const [firstInitial, secondInitial] = await Promise.all([
        getPlayerProfile(firstUser),
        getPlayerProfile(secondUser),
      ]);
      assert.equal(firstInitial.credits, 90);
      assert.equal(secondInitial.credits, 90);

      await db
        .update(playerProgressTable)
        .set({ credits: 400 })
        .where(eq(playerProgressTable.userId, firstUser));
      const firstRefit = await applyPlayerAction(firstUser, {
        idempotencyKey: randomUUID(),
        action: "refit",
      });
      assert.equal(firstRefit.profile.credits, 280);
      assert.equal((await getPlayerProfile(secondUser)).credits, 90);

      const firstRun = await startPlayerStrike(firstUser, selection);
      await assert.rejects(
        claimPlayerStrike(secondUser, firstRun.runId, []),
        (error: unknown) => error instanceof ProgressionError && error.status === 404,
      );
      const secondProfile = await getPlayerProfile(secondUser);
      assert.equal(secondProfile.credits, 90);
      assert.equal(secondProfile.cleared, 0);
    } finally {
      for (const userId of [firstUser, secondUser]) {
        await db.delete(progressionEventsTable).where(eq(progressionEventsTable.userId, userId));
        await db.delete(strikeRunsTable).where(eq(strikeRunsTable.userId, userId));
        await db.delete(playerProgressTable).where(eq(playerProgressTable.userId, userId));
      }
    }
  },
);

test(
  "an expired server-issued run cannot grant a reward after interruption",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const userId = `test_interrupted_run_${randomUUID()}`;
    const selection = {
      shipId: "mandjet",
      faction: "accord",
      scheme: "arc",
      pace: "practice",
      mission: "contact",
      tech: null,
    } as const;

    try {
      const beforeStart = await getPlayerProfile(userId);
      const run = await startPlayerStrike(userId, selection);
      const beforeClaim = await getPlayerProfile(userId);
      assert.equal(beforeClaim.credits, beforeStart.credits);

      const [issuedRun] = await db
        .select()
        .from(strikeRunsTable)
        .where(eq(strikeRunsTable.id, run.runId));
      assert.ok(issuedRun);
      assert.equal(issuedRun.status, "open");

      // Model a server-issued run that expired while the player was interrupted.
      await db
        .update(strikeRunsTable)
        .set({ expiresAt: new Date(Date.now() - 1_000) })
        .where(eq(strikeRunsTable.id, run.runId));

      const claim = await claimPlayerStrike(userId, run.runId, []);
      assert.deepEqual(claim, { error: "expired" });
      const replayedExpiredClaim = await claimPlayerStrike(userId, run.runId, []);
      assert.deepEqual(replayedExpiredClaim, { error: "expired" });

      const afterClaim = await getPlayerProfile(userId);
      assert.equal(afterClaim.credits, beforeClaim.credits);
      assert.equal(afterClaim.cleared, beforeClaim.cleared);
      assert.equal(afterClaim.revision, beforeClaim.revision);
      const rewards = await db
        .select()
        .from(progressionEventsTable)
        .where(eq(progressionEventsTable.userId, userId));
      assert.equal(rewards.length, 0);
      const [expiredRun] = await db
        .select()
        .from(strikeRunsTable)
        .where(eq(strikeRunsTable.id, run.runId));
      assert.equal(expiredRun?.status, "expired");
    } finally {
      await db.delete(progressionEventsTable).where(eq(progressionEventsTable.userId, userId));
      await db.delete(strikeRunsTable).where(eq(strikeRunsTable.userId, userId));
      await db.delete(playerProgressTable).where(eq(playerProgressTable.userId, userId));
    }
  },
);

test(
  "an interrupted online room cannot be replayed as a single-player reward after restart",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const userId = `test_interrupted_room_${randomUUID()}`;
    const roomId = `ROOM${randomUUID().replaceAll("-", "").slice(0, 8)}`;
    let runtime = await startWingSocketServer(0, "127.0.0.1", {
      verifySessionToken: socketTestAuth.verifySessionToken,
    });
    const sockets: WebSocket[] = [];

    try {
      const before = await getPlayerProfile(userId);
      const socket = await openTestSocket(
        `ws://127.0.0.1:${runtime.port}/ws?room=${roomId}`,
        userId,
      );
      sockets.push(socket);

      const joined = waitForSocketPacket(socket, (packet) => packet.type === "joined");
      socket.send(JSON.stringify({ type: "join", name: "Pilot" }));
      const joinedPacket = await joined;
      const reconnectToken = String(joinedPacket.reconnectToken);

      const ready = waitForSocketPacket(socket, (packet) => {
        if (packet.type !== "lobby" || !Array.isArray(packet.players)) return false;
        return (packet.players as Array<{ ready?: boolean }>).some((player) => player.ready);
      });
      socket.send(JSON.stringify({ type: "ready", ready: true }));
      await ready;

      const started = waitForSocketPacket(socket, (packet) => packet.type === "started");
      socket.send(JSON.stringify({ type: "start" }));
      await started;

      const interrupted = waitForSocketPacket(socket, (packet) => packet.type === "interrupted");
      const closed = new Promise<{ code: number; reason: string }>((resolve) => {
        socket.once("close", (code, reason) => resolve({ code, reason: reason.toString() }));
      });
      const shutdown = runtime.close();
      const interruption = await interrupted;
      assert.equal(interruption.reason, "server_restart");
      socket.send(JSON.stringify({ type: "interrupted_ack" }));
      await shutdown;
      assert.deepEqual(await closed, { code: 4002, reason: "server_restart" });

      runtime = await startWingSocketServer(0, "127.0.0.1", {
        verifySessionToken: socketTestAuth.verifySessionToken,
      });
      const staleSocket = await openTestSocket(
        `ws://127.0.0.1:${runtime.port}/ws?room=${roomId}`,
        userId,
      );
      sockets.push(staleSocket);
      const staleSession = waitForSocketPacket(staleSocket, (packet) => packet.type === "error");
      staleSocket.send(JSON.stringify({
        type: "join",
        name: "Pilot",
        reconnectToken,
      }));
      assert.equal((await staleSession).reason, "session_lost");

      assert.equal(StrikeRunIdParams.safeParse({ runId: roomId }).success, false);
      await assert.rejects(
        claimPlayerStrike(userId, randomUUID(), []),
        (error: unknown) => error instanceof ProgressionError && error.status === 404,
      );

      const after = await getPlayerProfile(userId);
      assert.equal(after.credits, before.credits);
      assert.equal(after.cleared, before.cleared);
      assert.equal(after.revision, before.revision);
      assert.equal(
        (await db
          .select()
          .from(strikeRunsTable)
          .where(eq(strikeRunsTable.userId, userId))).length,
        0,
      );
      assert.equal(
        (await db
          .select()
          .from(progressionEventsTable)
          .where(eq(progressionEventsTable.userId, userId))).length,
        0,
      );
    } finally {
      await Promise.all(sockets.map(closeTestSocket));
      await runtime.close();
      await db.delete(progressionEventsTable).where(eq(progressionEventsTable.userId, userId));
      await db.delete(strikeRunsTable).where(eq(strikeRunsTable.userId, userId));
      await db.delete(playerProgressTable).where(eq(playerProgressTable.userId, userId));
    }
  },
);

test(
  "server progression owns credits, rejects locked missions, and claims each replay once",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const userId = `test_progression_${randomUUID()}`;
    const selection = {
      shipId: "mandjet",
      faction: "accord",
      scheme: "arc",
      pace: "practice",
      mission: "contact",
      tech: null,
    } as const;
    try {
      const initial = await getPlayerProfile(userId);
      assert.equal(initial.credits, 90);
      assert.equal(initial.cleared, 0);

      await assert.rejects(
        startPlayerStrike(userId, { ...selection, mission: "cage" }),
        (error: unknown) => error instanceof ProgressionError && error.status === 400,
      );

      await db
        .update(playerProgressTable)
        .set({ credits: 400 })
        .where(eq(playerProgressTable.userId, userId));
      const firstRun = await startPlayerStrike(userId, selection);
      assert.ok(firstRun.seed > 0);
      assert.equal(firstRun.config.seed, firstRun.seed);
      assert.equal(firstRun.config.refit, 0);

      const refit = {
        idempotencyKey: randomUUID(),
        action: "refit" as const,
      };
      const refitted = await applyPlayerAction(userId, refit);
      assert.equal(refitted.profile.credits, 280);
      assert.equal(refitted.profile.refit, 1);
      const refittedAgain = await applyPlayerAction(userId, refit);
      assert.equal(refittedAgain.profile.credits, 280);
      assert.equal(refittedAgain.replayed, true);

      const staleClaim = await claimPlayerStrike(userId, firstRun.runId, []);
      assert.deepEqual(staleClaim, { error: "profile_changed" });

      const currentRun = await startPlayerStrike(userId, selection);
      const { createMatch, step } = await import("./sim");
      const config = currentRun.config;
      const match = createMatch(config.shipId, config.faction, config.refit, config.pace, {
        seed: config.seed,
        goal: config.goal,
        disc: config.disc,
        allyCount: config.allyCount,
        foeCount: config.foeCount,
        tech: config.tech,
      });
      const input = {
        throttle: 0,
        yaw: 0,
        strafe: 0,
        pitch: 0,
        fire: false,
        ult: false,
        lock: false,
        evade: 0,
        preset: null,
      } as const;
      const replay = [];
      const frameLimit = (config.pace === "strike" ? 360 : 120) * 60;
      for (let frame = 0; frame < frameLimit && !match.over; frame += 1) {
        step(match, input, 1 / 60);
        replay.push(input);
      }
      assert.ok(match.over);

      await assert.rejects(
        claimPlayerStrike(userId, currentRun.runId, [...replay, input]),
        (error: unknown) => error instanceof ProgressionError &&
          error.status === 400 &&
          /maximum frame count|after the match ended/i.test(error.message),
      );

      const [claimA, claimB] = await Promise.all([
        claimPlayerStrike(userId, currentRun.runId, replay),
        claimPlayerStrike(userId, currentRun.runId, replay),
      ]);
      if ("error" in claimA || "error" in claimB) {
        assert.fail("A valid concurrent claim should award once and replay once.");
      }
      assert.deepEqual([claimA.replayed, claimB.replayed].sort(), [false, true]);
      const firstClaim = claimA.replayed ? claimB : claimA;
      assert.equal(firstClaim.profile.credits, 280 + firstClaim.gain);
      assert.equal(firstClaim.replayed, false);

      // Prove the reward survives a fresh profile read, not only the claim response.
      const persistedAfterFirstClaim = await getPlayerProfile(userId);
      assert.equal(persistedAfterFirstClaim.credits, firstClaim.profile.credits);
      assert.equal(persistedAfterFirstClaim.cleared, firstClaim.profile.cleared);

      const rewardEventKey = `strike:${currentRun.runId}`;
      const storedRewardEvents = await db
        .select()
        .from(progressionEventsTable)
        .where(eq(progressionEventsTable.idempotencyKey, rewardEventKey));
      assert.equal(storedRewardEvents.length, 1);
      assert.equal(storedRewardEvents[0].amount, firstClaim.gain);
      assert.equal(storedRewardEvents[0].balanceAfter, firstClaim.profile.credits);

      const retry = await claimPlayerStrike(userId, currentRun.runId, replay);
      assert.equal("error" in retry, false);
      if ("error" in retry) return;
      assert.equal(retry.profile.credits, 280 + firstClaim.gain);
      assert.equal(retry.replayed, true);

      // An exact duplicate must not write a second reward or change the persisted balance.
      const persistedAfterDuplicate = await getPlayerProfile(userId);
      assert.equal(persistedAfterDuplicate.credits, firstClaim.profile.credits);
      const rewardEventsAfterDuplicate = await db
        .select()
        .from(progressionEventsTable)
        .where(eq(progressionEventsTable.idempotencyKey, rewardEventKey));
      assert.equal(rewardEventsAfterDuplicate.length, 1);
      await assert.rejects(
        claimPlayerStrike(userId, currentRun.runId, [{
          throttle: 0,
          yaw: 0,
          strafe: 0,
          pitch: 0,
          fire: false,
          ult: false,
          lock: false,
          evade: 0,
          preset: null,
        }]),
        (error: unknown) => error instanceof ProgressionError && error.status === 409,
      );
      const afterChangedReplay = await getPlayerProfile(userId);
      assert.equal(afterChangedReplay.credits, firstClaim.profile.credits);
      assert.equal(afterChangedReplay.revision, firstClaim.profile.revision);
      assert.equal(
        (await db
          .select()
          .from(progressionEventsTable)
          .where(eq(progressionEventsTable.idempotencyKey, rewardEventKey))).length,
        1,
      );
    } finally {
      await db.delete(progressionEventsTable).where(eq(progressionEventsTable.userId, userId));
      await db.delete(strikeRunsTable).where(eq(strikeRunsTable.userId, userId));
      await db.delete(playerProgressTable).where(eq(playerProgressTable.userId, userId));
      await pool.end();
    }
  },
);
