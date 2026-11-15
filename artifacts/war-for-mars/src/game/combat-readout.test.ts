import assert from "node:assert/strict";
import test from "node:test";
import { combatLockCue } from "./combat-readout";

test("combat readout explains when the survey phase has no target", () => {
  assert.match(combatLockCue({ targetActive: false, canAcquire: false, lockHeld: false, lock: 0 }), /NO HOSTILE CONTACT/);
});

test("combat readout distinguishes bad firing solutions, acquisition, and a completed lock", () => {
  assert.match(combatLockCue({ targetActive: true, canAcquire: false, lockHeld: true, lock: 0.4 }), /AIM, CLOSE, OR CLEAR COVER/);
  assert.match(combatLockCue({ targetActive: true, canAcquire: true, lockHeld: true, lock: 0.42 }), /ACQUIRING LOCK · 42%/);
  assert.match(combatLockCue({ targetActive: true, canAcquire: true, lockHeld: false, lock: 1 }), /LOCK CONFIRMED · TAP MISSILE/);
});
