import assert from "node:assert/strict";
import test from "node:test";
import { armGyro, disarmGyro, gyroAim } from "./gyro";
import { clearInput, createBus, readInput, stickAxesFromDelta } from "./input";

function installOrientationWindow(permission: "granted" | "denied") {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const listeners = new Map<string, Array<EventListenerOrEventListenerObject>>();
  let added = 0;
  let removed = 0;
  const OrientationConstructor = class {
    static requestPermission = async () => permission;
  };
  const fakeWindow = {
    DeviceOrientationEvent: OrientationConstructor,
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const entries = listeners.get(type) ?? [];
      entries.push(listener);
      listeners.set(type, entries);
      added += 1;
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const entries = listeners.get(type) ?? [];
      listeners.set(type, entries.filter((entry) => entry !== listener));
      removed += 1;
    },
  } as unknown as Window;
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: fakeWindow });

  return {
    added: () => added,
    removed: () => removed,
    emit(type: string, gamma: number, beta: number) {
      const event = { gamma, beta } as DeviceOrientationEvent;
      for (const listener of listeners.get(type) ?? []) {
        if (typeof listener === "function") listener.call(fakeWindow, event);
        else listener.handleEvent(event);
      }
    },
    restore() {
      disarmGyro();
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else Reflect.deleteProperty(globalThis, "window");
    },
  };
}

test("touch sticks, firing, target lock, ability, evade, and power selection combine", () => {
  const bus = createBus("arc");
  bus.leftX = -0.5;
  bus.leftY = -0.6;
  bus.rightX = -0.5;
  bus.rightY = 0.25;
  bus.gyroYaw = 0.1;
  bus.gyroPitch = -0.2;
  bus.fireButton = true;
  bus.ultPulse = true;
  bus.lockPulse = true;
  bus.evadePulse = 1;
  bus.presetPulse = 3;

  const input = readInput(bus);
  assert.ok(Math.abs(input.yaw - 0.975) < 1e-9);
  assert.equal(input.throttle, 0.6);
  assert.equal(input.pitch, -0.45);
  assert.equal(input.fire, true);
  assert.equal(input.ult, true);
  assert.equal(input.lock, true);
  assert.equal(input.evade, 1);
  assert.equal(input.preset, 3);

  const next = readInput(bus);
  assert.equal(next.ult, false);
  assert.equal(next.lock, false);
  assert.equal(next.evade, 0);
  assert.equal(next.preset, null);
});

test("virtual stick starts neutral, ignores tiny drift, and clamps deliberate drag", () => {
  assert.deepEqual(stickAxesFromDelta(0, 0, 40), { x: 0, y: 0 });
  assert.deepEqual(stickAxesFromDelta(2, -1, 40), { x: 0, y: 0 });
  assert.deepEqual(stickAxesFromDelta(40, 0, 40), { x: 1, y: 0 });

  const diagonal = stickAxesFromDelta(80, 80, 40);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9);

  const bus = createBus("arc");
  bus.leftX = stickAxesFromDelta(40, 0, 40).x;
  assert.equal(readInput(bus).yaw, -1);
});

test("lost focus clears held keys, both sticks, and latched buttons", () => {
  const bus = createBus("strafe");
  bus.keys.add("Space");
  bus.override = new Set(["KeyW"]);
  bus.steerOverride = 1;
  bus.leftX = -1;
  bus.leftY = 1;
  bus.rightX = 1;
  bus.rightY = -1;
  bus.fireCanvas = true;
  bus.fireButton = true;
  bus.ultPulse = true;
  bus.lockPulse = true;
  bus.evadePulse = -1;
  bus.presetPulse = 2;
  clearInput(bus);

  assert.deepEqual(readInput(bus), {
    throttle: 0,
    yaw: 0,
    strafe: 0,
    pitch: 0,
    fire: false,
    ult: false,
    lock: false,
    evade: 0,
    preset: null,
  });
  assert.equal(bus.override, null);
});

test("missing sensor APIs and insecure pages retain touch-only controls", async () => {
  const fixture = installOrientationWindow("granted");
  try {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
    assert.equal(await armGyro(), false);
    assert.equal(fixture.added(), 0);
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(window, "DeviceOrientationEvent", { configurable: true, value: undefined });
    assert.equal(await armGyro(), false);
    assert.equal(fixture.added(), 0);
  } finally {
    fixture.restore();
  }
});

test("gyro denial keeps touch steering available and does not retain sensor listeners", async () => {
  const fake = installOrientationWindow("denied");
  try {
    assert.equal(await armGyro(), false);
    assert.equal(fake.added(), 0);
    const bus = createBus("strafe");
    bus.leftX = -0.75;
    assert.equal(readInput(bus).strafe, 0.75);
  } finally {
    fake.restore();
  }
});

test("gyro permission calibrates, resets on rotation, and removes listeners when disabled", async () => {
  const fake = installOrientationWindow("granted");
  try {
    assert.equal(await armGyro(), true);
    assert.equal(fake.added(), 2);
    fake.emit("deviceorientation", 0, 0);
    fake.emit("deviceorientation", 26, -26);
    assert.deepEqual(gyroAim(), { yaw: 0.6, pitch: 0.45 });
    fake.emit("orientationchange", 0, 0);
    assert.deepEqual(gyroAim(), { yaw: 0, pitch: 0 });
    disarmGyro();
    assert.equal(fake.removed(), 2);
    assert.deepEqual(gyroAim(), { yaw: 0, pitch: 0 });
  } finally {
    fake.restore();
  }
});
