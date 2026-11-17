import assert from "node:assert/strict";
import test from "node:test";
import { scoutDestination, updateScoutMemory } from "./patrol-awareness";

const origin = { x: 0, y: 0, z: 0 };
const pilot = {
  actorId: "enemy", position: { x: 300, y: 0, z: 0 },
  hostile: true, alive: true, connected: true, concealed: false,
};
test("sensors detect only living connected opposing pilots in 3D range", () => {
  assert.equal(updateScoutMemory(origin, undefined, [pilot], 0)?.mode, "tracking");
  for (const invalid of [
    { ...pilot, hostile: false }, { ...pilot, alive: false },
    { ...pilot, connected: false }, { ...pilot, concealed: true },
    { ...pilot, position: { x: 300, y: 600, z: 0 } },
  ]) assert.equal(updateScoutMemory(origin, undefined, [invalid], 0), undefined);
});
test("lost contact searches the copied last observation, not a hidden live pose", () => {
  const acquired = updateScoutMemory(origin, undefined, [pilot], 1)!;
  const hidden = { ...pilot, position: { x: 10000, y: 700, z: 2000 } };
  const memory = updateScoutMemory(origin, acquired, [hidden], 10)!;
  assert.equal(memory.mode, "searching");
  assert.deepEqual(memory.position, pilot.position);
  const destination = scoutDestination(memory, 20);
  assert.ok(Math.hypot(destination.x - 300, destination.y, destination.z) <= 100.001);
  assert.equal(updateScoutMemory(origin, memory, [hidden], 46), undefined);
  assert.equal(updateScoutMemory(origin, memory, [{ ...hidden, alive: false }], 12), undefined);
});
test("target stays stable, reacquires on detection, and memory survives disconnect briefly", () => {
  const memory = updateScoutMemory(origin, undefined, [pilot], 0)!;
  const next = updateScoutMemory(origin, memory, [
    { ...pilot, actorId: "closer", position: { x: 10, y: 0, z: 0 } }, pilot,
  ], 1)!;
  assert.equal(next.actorId, pilot.actorId);
  assert.equal(updateScoutMemory(origin, next, [{ ...pilot, connected: false }], 5)?.mode, "searching");
  assert.equal(updateScoutMemory(origin, next, [pilot], 6)?.mode, "tracking");
  pilot.position.x = 310;
  assert.equal(memory.position.x, 300, "sensor memories must not alias live positions");
  pilot.position.x = 300;
});
