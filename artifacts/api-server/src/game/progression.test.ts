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

      const firstClaim = await claimPlayerStrike(userId, currentRun.runId, replay);
      assert.equal("error" in firstClaim, false);
      if ("error" in firstClaim) return;
      assert.equal(firstClaim.profile.credits, 280 + firstClaim.gain);
      assert.equal(firstClaim.replayed, false);

      const retry = await claimPlayerStrike(userId, currentRun.runId, replay);
      assert.equal("error" in retry, false);
      if ("error" in retry) return;
      assert.equal(retry.profile.credits, 280 + firstClaim.gain);
      assert.equal(retry.replayed, true);
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
