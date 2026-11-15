import assert from "node:assert/strict";
import test from "node:test";
import { createBus, setCircularRollControl } from "./input";
import { readOrbitalPreviewInput } from "./orbital-flight-preview-input";

function previewBus() {
  const bus = createBus("arc");
  bus.orbital = true;
  bus.leftStickFlight = true;
  return bus;
}

test("native preview maps dual-stick and keyboard movement into the shared sector contract", () => {
  const bus = previewBus();
  bus.leftX = 0.35;
  bus.leftY = -0.7;
  bus.rightX = 0.25;
  bus.rightY = -0.4;
  bus.keys.add("ShiftLeft");
  bus.keys.add("Space");
  bus.keys.add("KeyR");

  const input = readOrbitalPreviewInput(bus);
  assert.equal(input.throttle, 0.7);
  assert.equal(input.boost, true);
  assert.equal(input.fire, true);
  assert.equal(input.lock, true);
  assert.ok(Number.isFinite(input.yaw));
  assert.ok(Number.isFinite(input.pitch));
});

test("missile pulse is passed through while full held target lock remains active", () => {
  const bus = previewBus();
  bus.keys.add("KeyR");
  bus.missilePulse = true;

  const input = readOrbitalPreviewInput(bus);
  assert.equal(input.lock, true);
  assert.equal(input.missile, true);
  assert.equal(bus.missilePulse, false);
});

test("live circle-roll intent reaches local Orbital flight without changing a wire contract", () => {
  const bus = previewBus();
  setCircularRollControl(bus, 0.72, 1000, 120);

  const input = readOrbitalPreviewInput(bus, 1050);
  assert.ok(input.roll > 0.7);
  assert.ok(input.roll <= 1);

  const expired = readOrbitalPreviewInput(bus, 1120);
  assert.equal(Math.abs(expired.roll), 0);
});

test("preview controls neutralize after release and do not create reward capabilities", () => {
  const bus = previewBus();
  bus.leftX = 0.8;
  bus.leftY = -1;
  bus.keys.add("Space");
  const moving = readOrbitalPreviewInput(bus);
  assert.equal(moving.fire, true);

  bus.leftX = 0;
  bus.leftY = 0;
  bus.keys.clear();
  const neutral = readOrbitalPreviewInput(bus);
  assert.equal(neutral.throttle, 0);
  assert.equal(neutral.fire, false);
  assert.equal(neutral.lock, false);
  assert.equal("reward" in neutral, false);
});
