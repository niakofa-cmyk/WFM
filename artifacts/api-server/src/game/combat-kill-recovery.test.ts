import assert from "node:assert/strict";
import test from "node:test";
import { combatKillRecovery, validCombatKillProgress } from "./combat-kill-recovery";
test("confirmed fighter and heavy kills restore capped maneuver energy only", () => {
  const empty = { kills: 0, streak: 0, bestStreak: 0 };
  assert.equal(combatKillRecovery(empty, 25, false).energy, 45);
  assert.equal(combatKillRecovery(empty, 25, true).energy, 55);
  assert.equal(combatKillRecovery(empty, 95, true).restored, 5);
  assert.equal(combatKillRecovery(empty, 100, false).energy, 100);
  assert.deepEqual(empty, { kills: 0, streak: 0, bestStreak: 0 });
});
test("milestones occur once at 5/10/15/20 and death resets streak, not confirmed total", () => {
  let state = { kills: 0, streak: 0, bestStreak: 0 };
  const milestones: number[] = [];
  for (let kill = 1; kill <= 22; kill++) {
    const result = combatKillRecovery(state, 0, false);
    state = result.progress;
    if (result.milestone) { milestones.push(result.milestone); assert.equal(result.restored, 30); }
  }
  assert.deepEqual(milestones, [5, 10, 15, 20]);
  const afterDeath = combatKillRecovery({ ...state, streak: 0 }, 0, false);
  assert.equal(afterDeath.progress.streak, 1);
  assert.equal(afterDeath.progress.kills, 23);
  assert.equal(afterDeath.progress.bestStreak, 22);
  assert.equal(afterDeath.milestone, null);
});
test("invalid progress or energy cannot mint recovery", () => {
  assert.equal(validCombatKillProgress({ kills: 1, streak: 5, bestStreak: 5 }), false);
  assert.throws(() => combatKillRecovery({ kills: 0, streak: 0, bestStreak: 0 }, NaN, false));
  assert.throws(() => combatKillRecovery({ kills: 0, streak: 0, bestStreak: 0 }, 101, false));
});
