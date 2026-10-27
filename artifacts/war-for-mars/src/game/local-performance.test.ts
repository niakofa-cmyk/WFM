import assert from "node:assert/strict";
import test from "node:test";
import { createLocalPerformanceRecorder } from "./local-performance";

function frame(
  timestampMs: number,
  frameIntervalMs: number,
  gameSeconds: number,
  pageVisible = true,
) {
  return { timestampMs, frameIntervalMs, gameSeconds, pageVisible };
}

test("collects compact overall and first/final game-minute frame statistics", () => {
  const recorder = createLocalPerformanceRecorder();
  recorder.recordFrame(frame(0, 16, 0));
  recorder.recordFrame(frame(16, 16, 30));
  recorder.recordFrame(frame(66, 50, 59.9));
  recorder.recordFrame(frame(116, 50, 300));
  recorder.recordFrame(frame(216, 100, 359.9));

  const summary = recorder.finish();
  assert.equal(summary.allVisibleFrames.frames, 4);
  assert.equal(summary.allVisibleFrames.averageFps, 18.5);
  assert.equal(summary.allVisibleFrames.p95FrameIntervalMs, 100);
  assert.equal(summary.allVisibleFrames.framesOver50Ms, 1);
  assert.equal(summary.allVisibleFrames.gapsOver250Ms, 0);
  assert.equal(summary.firstGameMinute.frames, 2);
  assert.equal(summary.firstGameMinute.p95FrameIntervalMs, 50);
  assert.equal(summary.finalGameMinute.frames, 2);
  assert.equal(summary.finalGameMinute.p99FrameIntervalMs, 100);
  assert.equal(summary.simulatedSeconds, 359.9);
  assert.equal(summary.targetGameSeconds, 360);
  assert.equal(summary.targetReached, true);
});

test("marks a match that ends before its selected sample duration as partial", () => {
  const recorder = createLocalPerformanceRecorder(360);
  recorder.recordFrame(frame(0, 16, 0));
  recorder.recordFrame(frame(221_700, 16, 221.7));
  const summary = recorder.finish();

  assert.equal(summary.targetGameSeconds, 360);
  assert.equal(summary.targetReached, false);
  assert.equal(summary.finalGameMinute.frames, 0);
});

test("excludes the frame interval crossing a background/restore transition", () => {
  const recorder = createLocalPerformanceRecorder();
  recorder.recordFrame(frame(0, 16, 0));
  recorder.recordFrame(frame(16, 16, 1));
  recorder.recordVisibilityChange({ timestampMs: 20, visible: false });
  recorder.recordFrame(frame(9000, 8984, 1, false));
  recorder.recordVisibilityChange({ timestampMs: 9000, visible: true });
  recorder.recordFrame(frame(9016, 16, 1));
  recorder.recordFrame(frame(9032, 16, 2));

  const summary = recorder.finish();
  assert.equal(summary.allVisibleFrames.frames, 2);
  assert.equal(summary.allVisibleFrames.averageFps, 62.5);
  assert.deepEqual(summary.visibility, { backgrounds: 1, restores: 1 });
  assert.equal(summary.elapsedWallSeconds, 9);
});

test("records browser memory as MiB and clearly marks unsupported readings", () => {
  const recorder = createLocalPerformanceRecorder();
  recorder.recordFrame(frame(0, 16, 0));
  recorder.recordMemorySample(0, { usedBytes: 4 * 1024 * 1024, totalBytes: 8 * 1024 * 1024 });
  recorder.recordMemorySample(180, null);

  const summary = recorder.finish();
  assert.equal(summary.heap.status, "available");
  assert.deepEqual(summary.heap.samples, [
    { gameSeconds: 0, usedMiB: 4, totalMiB: 8 },
    { gameSeconds: 180, usedMiB: null, totalMiB: null },
  ]);
});

test("ignores invalid frame and memory readings without throwing", () => {
  const recorder = createLocalPerformanceRecorder();
  recorder.recordFrame(frame(Number.NaN, 16, 0));
  recorder.recordFrame(frame(10, Number.NaN, 0));
  recorder.recordMemorySample(-1, null);
  recorder.recordMemorySample(0, { usedBytes: 10, totalBytes: 1 });

  const summary = recorder.finish();
  assert.equal(summary.allVisibleFrames.frames, 0);
  assert.equal(summary.heap.status, "unavailable");
  assert.deepEqual(summary.heap.samples, [
    { gameSeconds: 0, usedMiB: null, totalMiB: null },
  ]);
});

test("retains useful precision for rare slow frames", () => {
  const recorder = createLocalPerformanceRecorder();
  let timestampMs = 0;
  recorder.recordFrame(frame(timestampMs, 16, 0));
  for (let index = 0; index < 10_000; index += 1) {
    const interval = index === 9_999 ? 51 : 16;
    timestampMs += interval;
    recorder.recordFrame(frame(timestampMs, interval, 1));
  }

  assert.equal(recorder.finish().allVisibleFrames.percentFramesOver50Ms, 0.01);
});
