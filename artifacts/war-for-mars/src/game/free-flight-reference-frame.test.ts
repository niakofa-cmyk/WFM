import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  newFlight, universeCollisionSpheres, UNIVERSE_MOON_REFERENCE, UNIVERSE_MARS_REFERENCE,
  type FreeFlightSnapshotV1,
} from "@workspace/orbital-sim";
import { ownSharedFlightReference, reconcileSharedFlightPosition, sharedPointInLocalFrame } from "./free-flight-reference-frame";
import { ORIGIN_SECTOR, rebaseUniversePosition, universeDisplacement } from "./universe-sectors";
import { ORBITAL_MARS_CENTER, ORBITAL_MOON_CENTER, UNIVERSE_RENDER_Y_OFFSET } from "./orbital-universe-session";

function snapshot(x: number, y = 0, z = 0): FreeFlightSnapshotV1 {
  return {
    protocol: "orbital-freeflight-v1", rulesVersion: 5, sessionInstanceId: "shared-session",
    tick: 1, serverTime: 1, ownActorId: "self",
    actors: [{
      actorId: "self", own: true, kind: "pilot", faction: "ussf", shipId: "glide", callsign: "YOU",
      position: { x, y, z }, velocity: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }, yaw: 0, pitch: 0, speed: 0,
      hull: 10, hullMax: 100, shield: 0, shieldMax: 20, alive: true,
    }],
  };
}
const craft = () => ({ x: 42, z: 80, space: newFlight(), hull: 10, alive: true, yaw: 1 });
function near(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }

test("joining restores the server's real insertion point instead of keeping a private local origin", () => {
  const pilot = craft();
  const result = reconcileSharedFlightPosition(pilot, snapshot(120, 30, -170), ORIGIN_SECTOR, true)!;
  assert.deepEqual({ x: pilot.x, y: pilot.space.y, z: pilot.z }, { x: 120, y: 30, z: -170 });
  assert.deepEqual(result.translation, { x: 78, y: 30, z: -250 });
  assert.equal(pilot.hull, 10);
  assert.equal(pilot.alive, true);
  assert.equal(pilot.yaw, 1);
});

test("ongoing positional drift converges to server coordinates, not just server velocity", () => {
  const pilot = craft();
  for (let i = 0; i < 24; i++) reconcileSharedFlightPosition(pilot, snapshot(50, 10, 70), ORIGIN_SECTOR, false);
  near(pilot.x, 50); near(pilot.space.y, 10); near(pilot.z, 70);
  assert.equal(pilot.hull, 10);
});

test("two pilots on opposite sides of a sector boundary agree on Moon and each other's physical locations", () => {
  const a = ownSharedFlightReference(snapshot(250, 5, -190))!;
  const b = ownSharedFlightReference(snapshot(270, 5, -190))!;
  assert.notDeepEqual(a.sector, b.sector);
  const aFromB = sharedPointInLocalFrame(a.position, b.sector)!;
  const bFromA = sharedPointInLocalFrame(b.position, a.sector)!;
  near(aFromB.x - b.local.x, -20);
  near(bFromA.x - a.local.x, 20);
  for (const viewer of [a, b]) {
    const moon = sharedPointInLocalFrame(UNIVERSE_MOON_REFERENCE.position, viewer.sector)!;
    near(moon.x - viewer.local.x, viewer.moonOffset.x);
    near(moon.y - viewer.local.y, viewer.moonOffset.y);
    near(moon.z - viewer.local.z, viewer.moonOffset.z);
    near(Math.hypot(moon.x - viewer.local.x, moon.y - viewer.local.y, moon.z - viewer.local.z), viewer.moonRange);
    // Existing scene effects and remote meshes share this exact affine transform.
    const relativeRender = viewer.local.x + a.position.x - viewer.position.x;
    near(relativeRender, sharedPointInLocalFrame(a.position, viewer.sector)!.x);
  }
  near(a.moonOffset.x - b.moonOffset.x, 20);
});

test("crossing every sector face preserves global metres and translates the camera with the frame", () => {
  for (const axis of ["x", "y", "z"] as const) for (const direction of [-1, 1]) {
    const pilot = { ...craft(), x: 0, z: 0 };
    if (axis === "y") pilot.space.y = direction * 255;
    else pilot[axis] = direction * 255;
    const target = { x: 0, y: 0, z: 0, [axis]: direction * 260 };
    const result = reconcileSharedFlightPosition(pilot, snapshot(target.x, target.y, target.z), ORIGIN_SECTOR, false)!;
    assert.equal(result.address[axis], String(direction));
    near(result.translation![axis], -direction * 512);
    const local = { x: pilot.x, y: pilot.space.y, z: pilot.z };
    near(local[axis], -direction * 253.75);
    const world = universeDisplacement(ORIGIN_SECTOR, { x: 0, y: 0, z: 0 }, result.address, local)!;
    near(world[axis], direction * 258.25);
  }
});

test("distant recovery adopts the server sector without precision loss, and return distance is not reset at boundaries", () => {
  const pilot = craft();
  const result = reconcileSharedFlightPosition(pilot, snapshot(1_000_000, -700, 30), ORIGIN_SECTOR, true)!;
  const expected = rebaseUniversePosition(ORIGIN_SECTOR, { x: 1_000_000, y: -700, z: 30 });
  assert.deepEqual(result.address, expected.address);
  near(pilot.x, expected.local.x);
  assert.equal(sharedPointInLocalFrame(UNIVERSE_MOON_REFERENCE.position, result.address), null,
    "distant Moon isn't placed at a fake nearby location");
  const displacement = universeDisplacement(result.address, expected.local, ORIGIN_SECTOR, { x: 0, y: 0, z: 0 }, 10_000)!;
  near(displacement.x, -1_000_000);
});

test("authority collisions and both celestial visual centres use the same fixed Moon/Mars definitions", () => {
  const colliders = universeCollisionSpheres(ORIGIN_SECTOR);
  for (const [body, visual] of [
    [UNIVERSE_MOON_REFERENCE, ORBITAL_MOON_CENTER],
    [UNIVERSE_MARS_REFERENCE, ORBITAL_MARS_CENTER],
  ] as const) {
    assert.ok(colliders.some(c => c.x === body.position.x && c.y === body.position.y && c.z === body.position.z && c.r === body.radius));
    near(visual.x, body.position.x);
    near(visual.y, body.position.y + UNIVERSE_RENDER_Y_OFFSET);
    near(visual.z, body.position.z);
  }
});

test("no other pilot or non-finite position can define the local authoritative frame", () => {
  const invalid = snapshot(1);
  invalid.actors[0]!.own = false;
  assert.equal(ownSharedFlightReference(invalid), null);
  invalid.actors[0]!.own = true;
  invalid.actors[0]!.position.x = NaN;
  assert.equal(reconcileSharedFlightPosition(craft(), invalid, ORIGIN_SECTOR, true), null);
});

test("the live renderer uses the shared frame for position, beams, gravity and target indicators", () => {
  const arena = readFileSync(new URL("./Arena.tsx", import.meta.url), "utf8");
  assert.match(arena, /reconcileSharedFlightPosition\(pilot, sharedFrame.snapshot/);
  assert.match(arena, /sharedPointInLocalFrame\(position, address\)/);
  assert.match(arena, /sharedPointInLocalFrame\(tail, address\)/);
  assert.match(arena, /sharedPointInLocalFrame\(tip, address\)/);
  assert.match(arena, /sharedPointInLocalFrame\(well.center, address\)/);
  assert.match(arena, /sharedFlightGroups.get\(sharedLocked.actorId\)\?\.group.position/);
  assert.match(arena, /bracket.position.copy\(sharedLockedPosition\)/);
  assert.match(arena, /sharedLockedPosition.x - player.x/);
  assert.match(arena, /sectorNeighborhood.position.y = UNIVERSE_RENDER_Y_OFFSET/);
  assert.doesNotMatch(arena, /anchor.x \+ position.x - ownPosition.x/);
});
