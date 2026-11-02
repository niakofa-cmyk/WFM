import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { FACTION_PALETTE } from "./faction-palette";
import { SHIPS } from "./ships";
import {
  createFlight, flightForward, flightObjective, stepFlight, sphereHit, canLock,
  NEUTRAL_FLIGHT_INPUT, RUST_DISC_SECTOR, vectorLength,
  type FlightInput, type FlightState,
} from "./flight-sector";

function run(state: FlightState, frames: number, input: Partial<FlightInput> = {}) {
  for (let i = 0; i < frames; i++) stepFlight(state, { ...NEUTRAL_FLIGHT_INPUT, ...input }, 1 / 60);
}
const near = (actual: number, expected: number, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test("pitch creates actual vertical travel, not just a rendered pitch angle", () => {
  const flight = createFlight();
  run(flight, 45, { pitch: 0.7 });
  run(flight, 60, { throttle: 0.7 });
  assert.ok(flight.position.y > 5);
  assert.ok(flight.velocity.y > 0);
  assert.ok(flight.position.z < 70);
});

test("yaw and roll compose in ship-local quaternion space and remain normalized", () => {
  const state = createFlight();
  run(state, 60, { roll: 1 });
  run(state, 40, { yaw: 1, throttle: 1 });
  assert.ok(Math.abs(state.position.y) > 1, "banked yaw must not stay on the X-Z plane");
  run(state, 3600, { roll: 0.5, yaw: 0.7, pitch: 0.9 });
  const q = state.orientation;
  near(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w, 1);
  near(vectorLength(flightForward(q)), 1);
});

test("momentum persists without thrust and braking stops it much faster", () => {
  const coast = createFlight(), brake = createFlight();
  run(coast, 30, { throttle: 1 }); run(brake, 30, { throttle: 1 });
  const before = vectorLength(coast.velocity);
  run(coast, 30); run(brake, 30, { brake: true });
  assert.ok(vectorLength(coast.velocity) > before / 2);
  assert.ok(vectorLength(brake.velocity) < vectorLength(coast.velocity) / 5);
});

test("boost consumes a bounded energy reserve; hull classes keep distinct handling", () => {
  const heavy = createFlight("mandjet"), fast = createFlight("shakuna");
  run(heavy, 40, { throttle: 1, boost: true }); run(fast, 40, { throttle: 1, boost: true });
  assert.ok(vectorLength(fast.velocity) > vectorLength(heavy.velocity));
  assert.ok(fast.energy < 100 && fast.energy >= 0);
  run(fast, 1200, { boost: true });
  assert.ok(fast.energy >= 0 && fast.energy <= 100);
});

test("3D swept sphere geometry catches tunneling and distinguishes vertical clearance", () => {
  const center = { x: 0, y: 0, z: 0 };
  near(sphereHit({ x: -100, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }, center, 10)!, 0.45);
  assert.equal(sphereHit({ x: -100, y: 11, z: 0 }, { x: 100, y: 11, z: 0 }, center, 10), null);
  assert.equal(sphereHit(center, center, center, 10), 0);
  assert.equal(sphereHit({ x: 12, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, center, 10), null);
});

test("sector geometry is versioned and ship collision separates the hull from a rock", () => {
  assert.equal(RUST_DISC_SECTOR.version, 1);
  const rock = RUST_DISC_SECTOR.rocks[0]!;
  const flight = createFlight();
  flight.position = { ...rock.position, x: rock.position.x - rock.radius - 2.1 };
  flight.velocity = { x: 60, y: 0, z: 0 };
  run(flight, 1);
  assert.ok(flight.collisions > 0);
  assert.ok(flight.hull < 100);
  assert.ok(Math.hypot(flight.position.x - rock.position.x, flight.position.y - rock.position.y, flight.position.z - rock.position.z) >= rock.radius + 2);
});

function targetingState() {
  const state = createFlight();
  state.stage = "drone";
  state.position = { x: 0, y: 48, z: -150 };
  return state;
}

test("lock requires range, forward cone and 3D line of sight; lost aim loses lock", () => {
  const state = targetingState();
  assert.equal(canLock(state), true);
  run(state, 80, { lock: true }); near(state.lock, 1);
  state.orientation = { x: 0, y: 1, z: 0, w: 0 };
  assert.equal(canLock(state), false);
  run(state, 60, { lock: true }); near(state.lock, 0);
  const rock = RUST_DISC_SECTOR.rocks[0]!;
  state.position = { ...rock.position, z: rock.position.z + 50 };
  state.drone.position = { ...rock.position, z: rock.position.z - 50 };
  state.orientation = { x: 0, y: 0, z: 0, w: 1 };
  assert.equal(canLock(state), false);
});

test("missile requests without a completed lock do not consume ammunition", () => {
  const state = targetingState();
  run(state, 60, { missile: true });
  assert.equal(state.missiles, 3);
  assert.equal(state.projectiles.filter(p => !p.hostile && p.guided).length, 0);
});

test("primary projectiles hit a real 3D target and complete the encounter", () => {
  const state = targetingState();
  run(state, 180, { fire: true });
  assert.equal(state.drone.hull, 0);
  assert.equal(state.stage, "extract");
  assert.equal(state.hits, 5);
});

test("guided launch consumes one round and applies a bounded cooldown", () => {
  const state = targetingState();
  state.lock = 1;
  run(state, 1, { missile: true, lock: true });
  assert.equal(state.missiles, 2);
  assert.ok(state.missileCooldown > 0);
  run(state, 75);
  assert.equal(state.drone.hull, 20);
});

test("cover blocks shots before the target, countermeasure clears only hostile missiles", () => {
  const state = targetingState(), rock = RUST_DISC_SECTOR.rocks[0]!;
  state.position = { ...rock.position, z: rock.position.z + 25 };
  state.drone.position = { ...rock.position, z: rock.position.z - 25 };
  run(state, 120, { fire: true });
  assert.equal(state.drone.hull, 60);
  state.projectiles = [
    { id: 100, position: { x: 200, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: -10 }, ttl: 5, hostile: true, guided: true },
    { id: 101, position: { x: 200, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: -10 }, ttl: 5, hostile: false, guided: true },
  ];
  run(state, 1, { countermeasure: true });
  assert.deepEqual(state.projectiles.map(p => p.id), [101]);
  assert.ok(state.flareCooldown > 0);
});

test("discovery and extraction are proximity-gated; terminal states cannot keep simulating", () => {
  const state = createFlight();
  run(state, 1); assert.equal(state.stage, "relay");
  state.position = { ...RUST_DISC_SECTOR.relay };
  run(state, 1); assert.equal(state.stage, "drone"); assert.equal(state.discoveries, 1);
  state.drone.hull = 0; run(state, 1); assert.equal(state.stage, "extract");
  assert.equal(flightObjective(state).label, "Return to extraction beacon");
  state.position = { ...RUST_DISC_SECTOR.extraction };
  run(state, 1); assert.equal(state.stage, "complete");
  const snapshot = structuredClone(state);
  run(state, 60, { fire: true, boost: true, throttle: 1 });
  assert.deepEqual(state, snapshot);
});

test("invalid inputs and excessive frame deltas cannot poison or fast-forward state", () => {
  const state = createFlight();
  stepFlight(state, { ...NEUTRAL_FLIGHT_INPUT, yaw: Infinity, throttle: NaN }, 100);
  assert.ok(state.elapsed <= 1 / 30);
  assert.ok(Number.isFinite(state.position.x));
  const elapsed = state.elapsed;
  stepFlight(state, NEUTRAL_FLIGHT_INPUT, NaN);
  near(state.elapsed, elapsed);
});

test("USSF hulls are blue and Accord hulls are warm, with no roster reassignment", () => {
  assert.equal(FACTION_PALETTE.ussf.accent, "#78bfff");
  assert.equal(FACTION_PALETTE.accord.accent, "#e0a15a");
  assert.equal(SHIPS.mandjet.faction, "accord");
  assert.equal(SHIPS.glide.faction, "ussf");
});

test("local flight sector has no progression, storage, auth or network capability", async () => {
  const source = await readFile(new URL("./flight-sector.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\b(fetch|WebSocket|localStorage|sessionStorage|saveServer|claimReward)\s*[.(]/);
  const imports = source.match(/^import .* from ["'](.+)["'];/gm);
  assert.deepEqual(imports, [
    'import { SHIPS, type ShipId } from "./ships";',
    'import { detSin, detCos, detExp } from "./detmath";',
  ]);
});
