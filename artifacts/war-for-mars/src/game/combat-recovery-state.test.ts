import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isCombatRecoveryState } from "./combat-recovery-state";
const packet = () => ({ type: "freeflight_combat_progress", protocol: 1,
  sessionInstanceId: "11111111-1111-4111-8111-111111111111", actorId: "pilot:12345678",
  tick: 12, energy: 60, kills: 5, streak: 5, bestStreak: 5, restored: 30, milestone: 5, reason: "kill" });
test("combat recovery accepts bounded absolute server energy and rejects forged/invalid resource state", () => {
  assert.ok(isCombatRecoveryState(packet()));
  for (const change of [{ energy: 101 }, { energy: NaN }, { restored: -1 }, { restored: 100 },
    { streak: 6 }, { kills: -1 }, { milestone: 10 }, { protocol: 2 }, { tick: -1 }])
    assert.equal(isCombatRecoveryState({ ...packet(), ...change }), false);
});
test("the live client binds recovery to the authenticated session, pilot and monotonic tick", () => {
  const client = readFileSync(new URL("./free-flight-client.ts", import.meta.url), "utf8");
  assert.match(client, /packet.sessionInstanceId === this.sessionInstanceId && packet.actorId === this.ownActorId/);
  assert.match(client, /packet.tick >= this.combatProgressTick/);
  const arena = readFileSync(new URL("./Arena.tsx", import.meta.url), "utf8");
  assert.match(arena, /pilot.space.energy = packet.energy/);
  assert.match(arena, /KILL CONFIRMED/);
});
