import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFlightControls } from "@workspace/orbital-sim";
import { FREE_FLIGHT_CONTROL_SEND_INTERVAL_MS, FreeFlightInputScheduler } from "./free-flight-input-scheduler";

test("free-flight control sampling stays below the server input limit at 60Hz", () => {
  const scheduler = new FreeFlightInputScheduler();
  const controls = normalizeFlightControls({ throttle: 0.5 });
  let sent = 0;

  for (let frame = 0; frame < 180; frame += 1) {
    if (scheduler.next(controls, frame * 1_000 / 60)) sent += 1;
  }

  assert.equal(FREE_FLIGHT_CONTROL_SEND_INTERVAL_MS, 50);
  assert.ok(sent <= 61, `expected <= 61 packets over three seconds, received ${sent}`);
  assert.ok(sent >= 59, `continuous flight controls should remain sampled, received ${sent}`);
});

test("short fire and missile taps survive between network samples", () => {
  const scheduler = new FreeFlightInputScheduler();
  const idle = normalizeFlightControls({});

  assert.ok(scheduler.next(idle, 0));
  assert.equal(scheduler.next({ ...idle, fire: true, missile: true, countermeasure: true }, 20), null);
  const sampled = scheduler.next(idle, 50);
  assert.equal(sampled?.fire, true);
  assert.equal(sampled?.missile, true);
  assert.equal(sampled?.countermeasure, true);
  assert.equal(scheduler.next(idle, 100)?.missile, false);
});

test("reset makes the next input immediate and clears pending weapon taps", () => {
  const scheduler = new FreeFlightInputScheduler();
  const idle = normalizeFlightControls({});

  assert.ok(scheduler.next(idle, 0));
  assert.equal(scheduler.next({ ...idle, missile: true }, 15), null);
  scheduler.reset();
  assert.equal(scheduler.next(idle, 16)?.missile, false);
});
