import assert from "node:assert/strict";
import test from "node:test";
import {
  AdaptiveResolutionController, FramePacingMonitor, RoundTripProbe,
  type FramePacingWindow,
} from "./flight-performance";

test("frame pacing samples one-second windows and summarizes frame-time tails", () => {
  const monitor = new FramePacingMonitor();
  assert.equal(monitor.record(0), null);
  let window: FramePacingWindow | null = null;
  for (let frame = 1; frame <= 61; frame++) window = monitor.record(frame * (1000 / 60)) ?? window;
  assert.ok(window);
  assert.equal(window.frameCount, 60);
  assert.ok(window.fps >= 59 && window.fps <= 61);
  assert.ok(window.averageFrameMs >= 16 && window.averageFrameMs <= 17);
  assert.ok(window.p95FrameMs <= 16.7);
  assert.equal(window.longFrameCount, 0);
});

test("background and app-switch gaps reset the sample instead of forcing low graphics", () => {
  const monitor = new FramePacingMonitor();
  monitor.record(0);
  for (let frame = 1; frame <= 30; frame++) monitor.record(frame * 16.67);
  assert.equal(monitor.record(2000), null);
  let next: FramePacingWindow | null = null;
  for (let frame = 1; frame <= 61; frame++) next = monitor.record(2000 + frame * 16.67) ?? next;
  assert.ok(next);
  assert.equal(next.longFrameCount, 0);
});

test("adaptive resolution waits for repeated slow windows and never changes gameplay state", () => {
  const controller = new AdaptiveResolutionController();
  const slow: FramePacingWindow = { frameCount: 60, fps: 35, averageFrameMs: 28, p95FrameMs: 33.3, longFrameCount: 4 };
  assert.equal(controller.update(slow, 1000), null);
  assert.equal(controller.currentScale, 1);
  assert.equal(controller.update(slow, 2000), 0.9);
  assert.equal(controller.update(slow, 3000), null, "resolution changes are rate-limited");
  assert.equal(controller.update(slow, 4100), 0.8);
  assert.equal(controller.update(slow, 5100), null);
  assert.equal(controller.update(slow, 6100), 0.7);
  assert.equal(controller.update(slow, 8100), null, "scale cannot fall below its floor");
});

test("adaptive resolution recovers slowly after sustained smooth frames", () => {
  const controller = new AdaptiveResolutionController();
  const slow: FramePacingWindow = { frameCount: 50, fps: 40, averageFrameMs: 25, p95FrameMs: 33.3, longFrameCount: 2 };
  controller.update(slow, 1000);
  controller.update(slow, 2000);
  assert.equal(controller.currentScale, 0.9);

  const smooth: FramePacingWindow = { frameCount: 60, fps: 60, averageFrameMs: 16.7, p95FrameMs: 16.7, longFrameCount: 0 };
  let change: number | null = null;
  for (let i = 1; i <= 8; i++) change = controller.update(smooth, 2000 + i * 1000) ?? change;
  assert.equal(change, 0.95);
  assert.equal(controller.update(smooth, 11000), null);
});

test("round-trip probe rejects stale or mismatched pongs and accepts only its current nonce", () => {
  const probe = new RoundTripProbe();
  const nonce = probe.begin(100);
  assert.equal(nonce, 1);
  assert.equal(probe.begin(110), null, "only one probe may be outstanding");
  assert.equal(probe.accept(nonce! + 1, 140), null);
  assert.equal(probe.accept(nonce!, 142), 42);
  assert.equal(probe.accept(nonce!, 150), null);
});

test("round-trip probe expires unanswered requests and rejects invalid clocks", () => {
  const probe = new RoundTripProbe();
  assert.equal(probe.begin(Number.NaN), null);
  const nonce = probe.begin(0);
  probe.expire(5001);
  assert.equal(probe.accept(nonce!, 5010), null);
  assert.equal(probe.begin(6000), 2);
});
