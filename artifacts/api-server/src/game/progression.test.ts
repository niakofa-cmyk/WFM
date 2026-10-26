import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
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

      const firstClaim = await claimPlayerStrike(userId, currentRun.runId, replay);
      assert.equal("error" in firstClaim, false);
      if ("error" in firstClaim) return;
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
    } finally {
      await db.delete(progressionEventsTable).where(eq(progressionEventsTable.userId, userId));
      await db.delete(strikeRunsTable).where(eq(strikeRunsTable.userId, userId));
      await db.delete(playerProgressTable).where(eq(playerProgressTable.userId, userId));
      await pool.end();
    }
  },
);
