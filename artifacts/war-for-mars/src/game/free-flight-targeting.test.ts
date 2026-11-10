import assert from "node:assert/strict";
import test from "node:test";
import {
  FREE_FLIGHT_TARGETING_V1, cycleFreeFlightTarget, isFreeFlightTargetState,
  acquireTarget, integrateSpatialFlight, missileCanLaunch, MISSILE_CATALOG,
  newFlight, spawnMissileVolley, type SpatialCraft,
} from "@workspace/orbital-sim";

const sessionInstanceId = "00000000-0000-4000-8000-000000000001";
const state = (value: Record<string, unknown> = {}) => ({
  protocol: FREE_FLIGHT_TARGETING_V1, sessionInstanceId, tick: 1,
  targetActorId: "patrol-ship:target001", lockProgress: .75,
  missileReady: false, missileCooldown: 0, ammo: 4, ...value,
});

test("authoritative target state accepts a valid lock and rejects stale, forged or incoherent values", () => {
  assert.equal(isFreeFlightTargetState(state()), true);
  for (const bad of [
    state({ tick: -1 }), state({ lockProgress: 1.1 }), state({ lockProgress: NaN }),
    state({ ammo: -1 }), state({ missileCooldown: 61 }), state({ targetActorId: "enemy" }),
    state({ unknown: true }), state({ targetActorId: null, lockProgress: .5 }),
    state({ targetActorId: null, missileReady: true }),
    { ...state(), sessionInstanceId: "not-a-session" },
  ]) assert.equal(isFreeFlightTargetState(bad), false);
});

test("hostile cycling is deterministic, wraps, starts cleanly and preserves a sole selected target", () => {
  const a = { actorId: "patrol-ship:alpha001" };
  const b = { actorId: "patrol-ship:bravo001" };
  assert.equal(cycleFreeFlightTarget([b, a], null), a);
  assert.equal(cycleFreeFlightTarget([b, a], a.actorId), b);
  assert.equal(cycleFreeFlightTarget([b, a], b.actorId), a);
  assert.equal(cycleFreeFlightTarget([a], a.actorId), a);
  assert.equal(cycleFreeFlightTarget([], null), null);
  assert.equal(cycleFreeFlightTarget([b, a], "a-destroyed-target"), a);
});

function fighter(id: number, z: number): SpatialCraft {
  return {
    id, x: 0, z, yaw: 0, pitch: 0, speed: 0, steer: 0,
    hull: 100, hullMax: 100, alive: true, root: 0, jam: 0, boost: 0,
    cloak: 0, untargetable: 0, radius: 1, lockTargetId: null, space: newFlight(),
  };
}

test("nearest-first cycling uses live 3D distance, wraps and breaks equal-distance ties by ID", () => {
  const near = { actorId: "z-near", x: 0, y: 3, z: 4 };
  const far = { actorId: "a-far", x: 0, y: 0, z: 90 };
  const middle = { actorId: "m-middle", x: 0, y: 12, z: 0 };
  const candidates = [far, middle, near];
  const distance = (candidate: typeof near) => Math.hypot(candidate.x, candidate.y, candidate.z);
  assert.equal(cycleFreeFlightTarget(candidates, null, distance), near);
  assert.equal(cycleFreeFlightTarget(candidates, near.actorId, distance), middle);
  assert.equal(cycleFreeFlightTarget(candidates, middle.actorId, distance), far);
  assert.equal(cycleFreeFlightTarget(candidates, far.actorId, distance), near);
  assert.equal(cycleFreeFlightTarget(candidates, "destroyed", distance), near);
  assert.deepEqual(candidates, [far, middle, near], "selection never mutates the shared roster");
  const tie = { ...near, actorId: "b-near" };
  assert.equal(cycleFreeFlightTarget([near, tie], null, distance), tie);
  assert.equal(cycleFreeFlightTarget([near], null, () => NaN), near);
  assert.equal(cycleFreeFlightTarget(candidates, null, c => c === far ? NaN : distance(c)), near);
  const pilotAt90 = (candidate: typeof near) => Math.hypot(candidate.x, candidate.y, candidate.z - 90);
  assert.equal(cycleFreeFlightTarget(candidates, null, pilotAt90), far,
    "an explicit nearest request uses the pilot's new position");
});

test("server flight tracking holds a guided-missile lock while moving, fires at that target and reacquires switches", () => {
  const pilot = fighter(1, 0), target = fighter(2, -35);
  const seeker = MISSILE_CATALOG["heavy-seeker"];
  pilot.space!.ammo = 4;
  pilot.lockTargetId = pilot.space!.lockTargetId = target.id;
  const controls = {
    throttle: 0, yaw: 0, pitch: 0, strafe: .04, vertical: .02, roll: 0,
    fire: true, missile: false, boost: false, brake: false, inertial: false,
    aimAssist: false, countermeasure: false,
  };
  for (let tick = 0; tick < 150; tick++) {
    integrateSpatialFlight(
      pilot, controls, 1 / 60, 1, [], { turnRate: 1.8, handling: 1, accel: 55, maxSpeed: 60 },
      { boundaryRadius: null },
    );
    acquireTarget(pilot, target, 1 / 60, [], seeker);
  }
  assert.ok(pilot.x < 0, "the pilot really translated during lock acquisition");
  assert.ok(pilot.yaw === 0, "the movement didn't turn the firing heading");
  assert.equal(pilot.space!.lockProgress, 1);
  assert.equal(missileCanLaunch(pilot, target, 0, [], seeker), true);
  const volley = spawnMissileVolley(pilot, target, 0, 30, [], seeker);
  assert.ok(volley.length > 0);
  assert.ok(volley.every(missile => missile.homeId === target.id),
    "the guided projectile homes on the selected target");

  const replacement = fighter(3, -24);
  pilot.space!.missileCd = 0;
  pilot.lockTargetId = replacement.id;
  acquireTarget(pilot, replacement, 1 / 60, [], seeker);
  assert.ok(pilot.space!.lockProgress < .02, "switching drops prior lock charge and reacquires independently");
  assert.equal(missileCanLaunch(pilot, target, 0, [], seeker), false,
    "a missile cannot launch against the now-deselected target");
  replacement.alive = false;
  acquireTarget(pilot, replacement, 1 / 30, [], seeker);
  assert.equal(pilot.space!.lockProgress, 0, "a destroyed lock is cleared");
  assert.equal(missileCanLaunch(pilot, replacement, 0, [], seeker), false);
});
