import assert from "node:assert/strict";
import test from "node:test";
import { createLocalPerformanceRecorder } from "./local-performance";

function frame(
  timestampMs: number,
  frameIntervalMs: number,
  gameSeconds: number,
  pageVisible = true,
  phase?: "active-play" | "post-match",
) {
  return { timestampMs, frameIntervalMs, gameSeconds, pageVisible, phase };
}

test("collects compact overall and first/final game-minute frame statistics", () => {
  const recorder = createLocalPerformanceRecorder();
  recorder.recordFrame(frame(0, 16, 0));
  recorder.recordFrame(frame(16, 16, 30));
  recorder.recordFrame(frame(66, 50, 59.9));
  recorder.recordFrame(frame(116, 50, 300));
  recorder.recordFrame(frame(216, 100, 360));

  const summary = recorder.finish();
  assert.equal(summary.activePlayFrames.frames, 4);
  assert.equal(summary.activePlayFrames.averageFps, 18.5);
  assert.equal(summary.activePlayFrames.p95FrameIntervalMs, 100);
  assert.equal(summary.activePlayFrames.framesOver50Ms, 1);
  assert.equal(summary.activePlayFrames.gapsOver250Ms, 0);
  assert.equal(summary.firstGameMinute.frames, 2);
  assert.equal(summary.firstGameMinute.p95FrameIntervalMs, 50);
  assert.equal(summary.finalGameMinute.frames, 2);
  assert.equal(summary.finalGameMinute.p99FrameIntervalMs, 100);
  assert.equal(summary.activeGameSeconds, 360);
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

test("aggregates active seconds across natural rounds and separates result-screen frames", () => {
  const recorder = createLocalPerformanceRecorder(360);
  recorder.recordFrame(frame(0, 16, 0));
  recorder.recordFrame(frame(221_700, 221_700, 221.7));
  recorder.recordFrame(frame(221_716, 16, 221.7, true, "post-match"));
  recorder.recordFrame(frame(226_716, 5000, 221.7, true, "post-match"));

  recorder.recordRoundFinished();
  recorder.beginNextRound();
  recorder.recordFrame(frame(226_732, 16, 0));
  recorder.recordFrame(frame(365_032, 138_300, 138.3));

  const summary = recorder.finish();
  assert.equal(summary.activeGameSeconds, 360);
  assert.equal(summary.targetReached, true);
  assert.equal(summary.roundsStarted, 2);
  assert.equal(summary.roundsCompleted, 1);
  assert.equal(summary.activePlayFrames.frames, 2);
  assert.equal(summary.postMatchFrames.frames, 1);
  assert.equal(summary.activeFrameSeconds, 360);
  assert.equal(summary.postMatchFrameSeconds, 5);
  assert.equal(summary.nonSampledWallSeconds, 0);
  assert.equal(summary.finalGameMinute.frames, 1);
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
  assert.equal(summary.activePlayFrames.frames, 2);
  assert.equal(summary.activePlayFrames.averageFps, 62.5);
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
  assert.equal(summary.activePlayFrames.frames, 0);
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

  assert.equal(recorder.finish().activePlayFrames.percentFramesOver50Ms, 0.01);
});
