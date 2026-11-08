import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { integrateSpatialFlight, newFlight, normalizeFlightControls } from "@workspace/orbital-sim";
import type { FlightControls, SpatialCraft } from "@workspace/orbital-sim";
import { clearInput, createBus, readInput, setCircularRollControl } from "./input";
import { ROSTER, SHIPS } from "./ships";

const tuning = SHIPS[ROSTER.ussf[0]];
function pilot() {
  const bus = createBus("arc");
  bus.orbital = true;
  bus.leftStickFlight = true;
  return bus;
}
function craft(): SpatialCraft {
  return {
    id: 0, x: 0, z: 36, yaw: 0, pitch: 0, speed: 0, steer: 0,
    hull: 100, hullMax: 100, alive: true, root: 0, jam: 0, boost: 0,
    cloak: 0, untargetable: 0, radius: .8, lockTargetId: null, space: newFlight(0),
  };
}
function advance(ship: SpatialCraft, controls: FlightControls, steps = 30) {
  for (let tick = 0; tick < steps; tick++) {
    integrateSpatialFlight(ship, controls, 1 / 60, 1, [], tuning, { boundaryRadius: 90 });
  }
}

test("the retired approach link routes into the native Cinder flight", () => {
  const source = readFileSync(new URL("./CinderRingDockingApproach.tsx", import.meta.url), "utf8");
  assert.match(source, /separate legacy approach scene is retired/);
  assert.match(source, /combat-lab\.html\?universe=1&destination=cinder-ring/);
  assert.doesNotMatch(source, /from ["']three["']/);
});

test("the approach's shared pilot path accelerates forward and in reverse from the left thumb", () => {
  for (const direction of [-1, 1]) {
    const bus = pilot();
    const ship = craft();
    bus.leftY = direction * .7;
    const controls = normalizeFlightControls(readInput(bus, 1000));
    assert.ok(controls.throttle * direction < 0);
    assert.equal(controls.pitch, 0, "left throttle must not also rotate the nose");
    advance(ship, controls);
    assert.ok((ship.z - 36) * direction > 0, "throttle must translate the hull, not merely animate the stick");
  }
});

test("combined left thrust/turn and right pitch feed real approach spatial flight", () => {
  const bus = pilot();
  bus.leftY = -.7;
  bus.leftX = .5;
  bus.rightY = -.6;
  const controls = normalizeFlightControls(readInput(bus, 1000));
  assert.ok(controls.throttle > 0);
  assert.notEqual(controls.yaw, 0);
  assert.notEqual(controls.roll, 0, "turning should retain coordinated bank");
  assert.ok(controls.pitch > 0);
  const ship = craft();
  advance(ship, controls);
  assert.ok(ship.space!.y > 0);
  assert.ok(Math.abs(ship.x) > .001);
  assert.ok(ship.z < 36);
});

test("direct right-thumb roll reaches shared spatial rules without a queued full-circle animation", () => {
  const bus = pilot();
  setCircularRollControl(bus, .9, 1000);
  const controls = normalizeFlightControls(readInput(bus, 1001));
  assert.deepEqual(controls.maneuver, { version: 1, kind: "barrel-roll-control", input: .9 });
  const ship = craft();
  advance(ship, controls, 1);
  assert.notEqual(ship.space!.q[2], 0, "direct input must rotate the actual hull on the first flight step");
  const length = Math.hypot(...ship.space!.q);
  assert.ok(Math.abs(length - 1) < 1e-6);
  assert.ok(ship.space!.energy >= 0 && ship.space!.energy <= 100);
  assert.equal(normalizeFlightControls(readInput(bus, 1120)).maneuver, undefined);
});

test("approach reset neutralizes both thumbs and roll while braking remains an explicit command", () => {
  const bus = pilot();
  bus.leftY = -.8;
  bus.leftX = .5;
  bus.rightY = -.4;
  bus.keys.add("KeyB");
  setCircularRollControl(bus, 1, 1000);
  assert.equal(normalizeFlightControls(readInput(bus, 1001)).brake, true);
  clearInput(bus);
  const input = normalizeFlightControls(readInput(bus, 1002));
  for (const key of ["throttle", "yaw", "pitch", "roll", "strafe", "vertical"] as const) {
    assert.ok(input[key] === 0, `${key} survived neutralization`);
  }
  assert.equal(input.brake, false);
  assert.equal(input.maneuver, undefined);
});
