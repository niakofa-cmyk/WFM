import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRightThumbProfile, rightThumbFlightAxes,
  newVectorBoost, startVectorBoost, stepVectorBoost, vectorBoostAxes,
  VECTOR_BOOST_DIRECTIONS, newFlight, integrateSpatialFlight, type SpatialCraft,
} from "@workspace/orbital-sim";
import { createBus, clearInput, readInput, requestRightVectorBoost, setCircularRollControl } from "./input";
import { blocksFlightHotkeys, boostDirectionAt, registerBoostGesture,
  loadRightThumbProfile, saveRightThumbProfile } from "./right-thumb-controls";

test("flight hotkeys leave native settings sliders and editable controls usable", () => {
  for (const tag of ["input", "SELECT", "textarea"]) assert.equal(blocksFlightHotkeys(tag), true);
  assert.equal(blocksFlightHotkeys("DIV", true), true);
  assert.equal(blocksFlightHotkeys("CANVAS"), false);
});

test("right thumb moves the hull in all eight directions while retaining aim", () => {
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) {
    const bus = createBus("arc");
    bus.orbital = bus.leftStickFlight = true;
    bus.rightThumbProfile = normalizeRightThumbProfile();
    bus.rightX = x; bus.rightY = y; bus.leftY = -.6; bus.fireButton = true;
    const input = readInput(bus);
    assert.equal(Math.sign(input.strafe) === (x === 0 ? 0 : -x), true);
    assert.equal(Math.sign(input.vertical ?? 0) === (y === 0 ? 0 : -y), true);
    assert.equal(input.throttle, .6);
    assert.equal(input.fire, true);
    assert.ok(Math.hypot(input.strafe, input.vertical ?? 0) <= 1 + 1e-12);
    clearInput(bus);
    assert.equal(readInput(bus).strafe === 0, true);
    assert.equal(readInput(bus).vertical, 0);
  }
});

test("aim-only profile and Wing keep their original no-vector mapping", () => {
  const bus = createBus("arc");
  bus.orbital = bus.leftStickFlight = true;
  bus.rightThumbProfile = normalizeRightThumbProfile({ mode: "aim" });
  bus.rightX = 1; bus.rightY = -1;
  assert.equal(readInput(bus).strafe === 0, true);
  assert.equal(readInput(bus).vertical, 0);
  bus.leftStickFlight = false;
  bus.rightThumbProfile = normalizeRightThumbProfile();
  assert.equal(readInput(bus).strafe === 0, true);
  assert.equal(readInput(bus).vertical, 0);
});

test("response gains are bounded and diagonal translation is normalized", () => {
  const profile = normalizeRightThumbProfile({ attitudeGain: Infinity, translationGain: 20 });
  const axes = rightThumbFlightAxes(1, -1, profile);
  assert.equal(profile.attitudeGain, 1);
  assert.equal(profile.translationGain, 1);
  assert.ok(Math.abs(Math.hypot(axes.strafe, axes.vertical) - 1) < 1e-12);
  assert.equal(rightThumbFlightAxes(NaN, Infinity, profile).strafe, 0);
});

test("two matching deliberate gestures trigger one eight-way burst; mismatches and tremors do not", () => {
  assert.equal(boostDirectionAt(.1, .1), null);
  for (const direction of VECTOR_BOOST_DIRECTIONS) {
    const axes = vectorBoostAxes(direction);
    assert.equal(boostDirectionAt(axes.x, -axes.y), direction);
    const first = registerBoostGesture({ direction: null, at: 0, cooldownUntil: 0 }, direction, 1000);
    assert.equal(first.boost, null);
    const second = registerBoostGesture(first.state, direction, 1100);
    assert.equal(second.boost, direction);
    assert.equal(registerBoostGesture(second.state, direction, 1150).boost, null);
  }
  const first = registerBoostGesture({ direction: null, at: 0, cooldownUntil: 0 }, "up", 1000);
  assert.equal(registerBoostGesture(first.state, "down", 1100).boost, null);
  assert.equal(registerBoostGesture(first.state, "up", 1400).boost, null);
  assert.equal(registerBoostGesture(first.state, "up", 1010).boost, null);
});

const idle = { throttle: 0, yaw: 0, strafe: 0, pitch: 0 };
const tuning = { turnRate: 1.8, handling: 1, accel: 55, maxSpeed: 60 };
function craft(): SpatialCraft {
  return { id: 1, x: 0, z: 0, yaw: 0, pitch: 0, speed: 0, steer: 0,
    hull: 100, hullMax: 100, alive: true, root: 0, jam: 0, boost: 0,
    cloak: 0, untargetable: 0, radius: 1, lockTargetId: null, space: newFlight() };
}

test("vector burst enforces energy, cooldown, disabled state and fixed duration without changing history inputs", () => {
  const burst = newVectorBoost();
  assert.equal(startVectorBoost(burst, "right", 0), false);
  assert.equal(startVectorBoost(burst, "right", 100, true), false);
  assert.equal(startVectorBoost(burst, "right", 100), true);
  assert.equal(startVectorBoost(burst, "left", 100), false);
  for (let i = 0; i < 8; i++) stepVectorBoost(burst, idle, 1 / 30);
  assert.equal(stepVectorBoost(burst, idle, 1 / 30), idle);
  assert.equal(startVectorBoost(burst, "left", 100), false);
  for (let i = 0; i < 40; i++) stepVectorBoost(burst, idle, 1 / 30);
  assert.equal(startVectorBoost(burst, "left", 100), true);
});

test("native physics makes cardinal and diagonal bursts equally strong, drains energy, and preserves targetability", () => {
  const speeds: number[] = [];
  for (const direction of VECTOR_BOOST_DIRECTIONS) {
    const pilot = craft(), burst = newVectorBoost();
    startVectorBoost(burst, direction, pilot.space!.energy);
    for (let i = 0; i < 8; i++) integrateSpatialFlight(
      pilot, stepVectorBoost(burst, idle, 1 / 30), 1 / 30, 1, [], tuning, { boundaryRadius: null },
    );
    speeds.push(Math.hypot(pilot.space!.vx, pilot.space!.vy, pilot.space!.vz));
    assert.ok(pilot.space!.energy < 100);
    assert.equal(pilot.untargetable, 0);
    assert.equal(pilot.hull, 100);
  }
  assert.ok(Math.max(...speeds) - Math.min(...speeds) < 1e-7);
});

test("timed lateral and vertical breaks evade a straight projectile corridor through displacement, not immunity", () => {
  for (const direction of ["right", "up", "up-right"] as const) {
    const stationary = craft(), evading = craft(), burst = newVectorBoost();
    startVectorBoost(burst, direction, 100);
    let parkedHit = false, evadingHit = false;
    for (let i = 0; i < 40; i++) {
      const dt = 1 / 60;
      integrateSpatialFlight(stationary, idle, dt, 1, [], tuning, { boundaryRadius: null });
      integrateSpatialFlight(evading, stepVectorBoost(burst, idle, dt), dt, 1, [], tuning, { boundaryRadius: null });
      const bulletZ = -40 + (i + 1) * 100 * dt;
      parkedHit ||= Math.hypot(stationary.x, stationary.space!.y, stationary.z - bulletZ) < 1.2;
      evadingHit ||= Math.hypot(evading.x, evading.space!.y, evading.z - bulletZ) < 1.2;
    }
    assert.equal(parkedHit, true);
    assert.equal(evadingHit, false);
    assert.equal(evading.untargetable, 0);
  }
});

test("vector-only mode translates in eight directions without right-thumb rotation or interrupting fire", () => {
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) {
    const bus = createBus("arc"), pilot = craft();
    bus.orbital = bus.leftStickFlight = true;
    bus.rightThumbProfile = normalizeRightThumbProfile({ mode: "vector" });
    bus.rightX = x; bus.rightY = y; bus.fireButton = true;
    const input = readInput(bus);
    assert.ok(input.yaw === 0);
    assert.ok(input.pitch === 0);
    assert.equal(input.fire, true);
    for (let tick = 0; tick < 30; tick++) integrateSpatialFlight(
      pilot, input, 1 / 60, 1, [], tuning, { boundaryRadius: null },
    );
    assert.ok(Math.abs(pilot.space!.q[0]) + Math.abs(pilot.space!.q[1]) +
      Math.abs(pilot.space!.q[2]) < 1e-12);
    assert.equal(Math.sign(pilot.x) === x, true);
    assert.equal(Math.sign(pilot.space!.y) === (y === 0 ? 0 : -y), true);
    assert.equal(pilot.untargetable, 0);
    bus.leftX = .5;
    assert.notEqual(readInput(bus).yaw, 0, "left-thumb steering remains independent");
  }
});

test("vector profile survives storage reload and corrupt data still selects the safe default", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  } });
  try {
    const profile = normalizeRightThumbProfile({ mode: "vector", attitudeGain: .6, translationGain: .8 });
    saveRightThumbProfile(profile);
    assert.deepEqual(loadRightThumbProfile(), profile);
    for (const key of data.keys()) data.set(key, "{broken");
    assert.deepEqual(loadRightThumbProfile(), normalizeRightThumbProfile());
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("offline bursts use the supplied sample clock, expire once and retain cooldown after interruption", () => {
  const bus = createBus("arc");
  bus.orbital = bus.leftStickFlight = true;
  bus.rightThumbProfile = normalizeRightThumbProfile({ mode: "vector" });
  bus.fireButton = true;
  bus.flightEnergy = 100;
  assert.equal(requestRightVectorBoost(bus, "up-right", 1000), true);
  const remaining = bus.rightBoost!.remaining;
  const first = readInput(bus, 1000);
  assert.equal(first.boost, true);
  assert.equal(first.fire, true);
  readInput(bus, 1000);
  assert.equal(bus.rightBoost!.remaining, remaining, "repeated sampling cannot consume a maneuver twice");
  for (let at = 1020; at <= 1260; at += 20) readInput(bus, at);
  assert.equal(readInput(bus, 1280).boost, false);
  assert.equal(requestRightVectorBoost(bus, "left", 1280), false);
  clearInput(bus);
  assert.equal(readInput(bus, 1300).boost, false);
  assert.equal(readInput(bus, 1300).fire, false);
  assert.equal(requestRightVectorBoost(bus, "left", 1300), false, "cancel cannot bypass recovery");
  for (let at = 1320; at <= 2500; at += 20) readInput(bus, at);
  assert.equal(requestRightVectorBoost(bus, "left", 2520), true);
  assert.equal(readInput(bus, 2400).boost, false, "a backward clock cancels rather than prolongs the burst");
  assert.throws(() => readInput(bus, NaN), /Invalid vector boost sample time/);
});

test("legacy modes, classic aiming and invalid clocks cannot start right-thumb bursts", () => {
  const bus = createBus("arc");
  assert.equal(requestRightVectorBoost(bus, "up", 1000), false);
  bus.orbital = bus.leftStickFlight = true;
  bus.rightThumbProfile = normalizeRightThumbProfile({ mode: "aim" });
  assert.equal(requestRightVectorBoost(bus, "up", 1000), false);
  bus.rightThumbProfile = normalizeRightThumbProfile({ mode: "hybrid" });
  assert.equal(requestRightVectorBoost(bus, "up", NaN), false);
  assert.equal(requestRightVectorBoost(bus, "up", -1), false);
  assert.equal(requestRightVectorBoost(bus, "up", 1000, true), false);
  assert.equal(bus.rightBoost, undefined);
  for (const destination of ["aim", "legacy-orbital", "wing"]) {
    const active = createBus("arc");
    active.orbital = active.leftStickFlight = true;
    active.rightThumbProfile = normalizeRightThumbProfile({ mode: "vector" });
    assert.equal(requestRightVectorBoost(active, "up", 1000), true);
    assert.equal(readInput(active, 1000).boost, true);
    if (destination === "aim") active.rightThumbProfile.mode = "aim";
    if (destination === "legacy-orbital") active.leftStickFlight = false;
    if (destination === "wing") active.orbital = false;
    assert.notEqual(readInput(active, 1020).boost, true);
    active.orbital = active.leftStickFlight = true;
    active.rightThumbProfile.mode = "vector";
    assert.equal(readInput(active, 1040).boost, false, "a mode change cannot revive an old burst");
  }
});

test("drift retains momentum, release resumes assistance and braking recovers without immunity", () => {
  const bus = createBus("arc");
  bus.orbital = bus.leftStickFlight = true;
  bus.rightThumbProfile = normalizeRightThumbProfile({ mode: "vector" });
  bus.rightX = 1;
  const pilots = [craft(), craft(), craft()];
  for (let tick = 0; tick < 30; tick++) for (const pilot of pilots) {
    integrateSpatialFlight(pilot, readInput(bus), 1 / 60, 1, [], tuning, { boundaryRadius: null });
  }
  bus.rightX = 0;
  for (let tick = 0; tick < 60; tick++) {
    bus.keys.add("KeyT");
    integrateSpatialFlight(pilots[0], readInput(bus), 1 / 60, 1, [], tuning, { boundaryRadius: null });
    bus.keys.delete("KeyT");
    integrateSpatialFlight(pilots[1], readInput(bus), 1 / 60, 1, [], tuning, { boundaryRadius: null });
    bus.keys.add("KeyB");
    integrateSpatialFlight(pilots[2], readInput(bus), 1 / 60, 1, [], tuning, { boundaryRadius: null });
    bus.keys.delete("KeyB");
  }
  assert.ok(Math.abs(pilots[0].space!.vx) > Math.abs(pilots[1].space!.vx));
  assert.ok(Math.abs(pilots[1].space!.vx) > Math.abs(pilots[2].space!.vx));
  for (const pilot of pilots) assert.equal(pilot.untargetable, 0);
});

test("circle roll, diagonal break and held primary fire share one native flight input", () => {
  const bus = createBus("arc"), pilot = craft();
  bus.orbital = bus.leftStickFlight = true;
  bus.rightThumbProfile = normalizeRightThumbProfile({ mode: "hybrid" });
  bus.fireButton = true;
  setCircularRollControl(bus, .8, 1000);
  assert.equal(requestRightVectorBoost(bus, "up-right", 1000), true);
  const input = readInput(bus, 1000);
  assert.equal(input.fire, true);
  assert.equal(input.boost, true);
  assert.equal(input.maneuver?.kind, "barrel-roll-control");
  integrateSpatialFlight(pilot, input, 1 / 30, 1, [], tuning, { boundaryRadius: null });
  assert.ok(Math.abs(pilot.space!.q[2]) > 0);
  assert.ok(pilot.x > 0 && pilot.space!.y > 0);
  assert.ok(pilot.space!.energy < 100);
  assert.equal(pilot.untargetable, 0);
  clearInput(bus);
  assert.equal(readInput(bus, 1034).maneuver, undefined);
  assert.equal(readInput(bus, 1034).boost, false);
});
