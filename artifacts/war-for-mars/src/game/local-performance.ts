export type LocalPerformanceFrame = {
  timestampMs: number;
  frameIntervalMs: number;
  gameSeconds: number;
  pageVisible: boolean;
  phase?: "active-play" | "post-match";
};

export type LocalPerformanceVisibilityChange = {
  timestampMs: number;
  visible: boolean;
};

export type BrowserHeapReading = {
  usedBytes: number;
  totalBytes: number;
};

type HeapSample = {
  gameSeconds: number;
  usedMiB: number | null;
  totalMiB: number | null;
};

type FrameStatsSummary = {
  frames: number;
  averageFps: number | null;
  p95FrameIntervalMs: number | null;
  p99FrameIntervalMs: number | null;
  framesOver50Ms: number;
  percentFramesOver50Ms: number | null;
  gapsOver250Ms: number;
};

export type LocalPerformanceSummary = {
  targetGameSeconds: number | null;
  targetReached: boolean | null;
  elapsedWallSeconds: number;
  activeFrameSeconds: number;
  postMatchFrameSeconds: number;
  nonSampledWallSeconds: number;
  activeGameSeconds: number;
  roundsStarted: number;
  roundsCompleted: number;
  activePlayFrames: FrameStatsSummary;
  postMatchFrames: FrameStatsSummary;
  firstGameMinute: FrameStatsSummary;
  finalGameMinute: FrameStatsSummary;
  visibility: {
    backgrounds: number;
    restores: number;
  };
  heap: {
    status: "available" | "unavailable";
    samples: HeapSample[];
  };
  thermalStatus: string;
  method: string;
};

export type LocalPerformanceDeviceInfo = {
  environment: string;
  chromeVersion: string;
  screenCssPixels: string;
  viewportCssPixels: string;
  orientationAtStart: string;
  devicePixelRatio: number;
};

type FrameInterval = {
  gameSeconds: number;
  intervalMs: number;
};

const HISTOGRAM_MAX_MS = 10_000;
const MEBIBYTE = 1024 * 1024;
const SIMULATION_TICK_SECONDS = 1 / 60;

function round(value: number, places = 1): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function createFrameStats() {
  const histogram = new Uint32Array(HISTOGRAM_MAX_MS + 1);
  let frames = 0;
  let totalMs = 0;
  let framesOver50Ms = 0;
  let gapsOver250Ms = 0;

  return {
    add(intervalMs: number) {
      if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;
      const bin = Math.min(HISTOGRAM_MAX_MS, Math.max(1, Math.round(intervalMs)));
      histogram[bin] += 1;
      frames += 1;
      totalMs += intervalMs;
      if (intervalMs > 50) framesOver50Ms += 1;
      if (intervalMs > 250) gapsOver250Ms += 1;
    },
    summary(): FrameStatsSummary {
      const percentile = (proportion: number): number | null => {
        if (frames === 0) return null;
        const targetRank = Math.max(1, Math.ceil(frames * proportion));
        let seen = 0;
        for (let bin = 1; bin <= HISTOGRAM_MAX_MS; bin += 1) {
          seen += histogram[bin];
          if (seen >= targetRank) return bin;
        }
        return HISTOGRAM_MAX_MS;
      };

      return {
        frames,
        averageFps: totalMs > 0 ? round((frames * 1000) / totalMs) : null,
        p95FrameIntervalMs: percentile(0.95),
        p99FrameIntervalMs: percentile(0.99),
        framesOver50Ms,
        percentFramesOver50Ms: frames > 0 ? round((framesOver50Ms / frames) * 100, 3) : null,
        gapsOver250Ms,
      };
    },
    get activeSeconds() {
      return totalMs / 1000;
    },
  };
}

export function createLocalPerformanceRecorder(targetGameSeconds = 360) {
  const targetDurationSeconds = Number.isFinite(targetGameSeconds) && targetGameSeconds > 0
    ? targetGameSeconds
    : null;
  const activePlayFrames = createFrameStats();
  const postMatchFrames = createFrameStats();
  const firstGameMinute = createFrameStats();
  const finalGameMinute = createFrameStats();
  const heapSamples: HeapSample[] = [];
  let startedAtMs: number | null = null;
  let lastTimestampMs: number | null = null;
  let lastFrameVisible: boolean | null = null;
  let lastFramePhase: "active-play" | "post-match" | null = null;
  let visibilityState: boolean | null = null;
  let skipNextInterval = false;
  let simulatedSeconds = 0;
  let lastRoundGameSeconds = 0;
  let roundsStarted = 1;
  let roundsCompleted = 0;
  let backgrounds = 0;
  let restores = 0;
  const isTargetReached = () =>
    targetDurationSeconds !== null &&
    simulatedSeconds >= targetDurationSeconds - SIMULATION_TICK_SECONDS;

  return {
    recordFrame(frame: LocalPerformanceFrame) {
      if (
        !Number.isFinite(frame.timestampMs) ||
        !Number.isFinite(frame.frameIntervalMs) ||
        !Number.isFinite(frame.gameSeconds) ||
        frame.frameIntervalMs < 0 ||
        frame.gameSeconds < 0
      ) return;

      const phase = frame.phase ?? "active-play";
      if (startedAtMs === null) startedAtMs = frame.timestampMs;
      const gameDelta = Math.max(0, frame.gameSeconds - lastRoundGameSeconds);
      if (frame.gameSeconds >= lastRoundGameSeconds) {
        lastRoundGameSeconds = frame.gameSeconds;
        simulatedSeconds += gameDelta;
      } else {
        // A round reset is only expected after beginNextRound().
        lastRoundGameSeconds = frame.gameSeconds;
      }
      if (visibilityState === null) visibilityState = frame.pageVisible;
      else if (visibilityState !== frame.pageVisible) {
        if (frame.pageVisible) restores += 1;
        else backgrounds += 1;
        visibilityState = frame.pageVisible;
        skipNextInterval = true;
      }

      // The final simulation step can set match.over before this RAF callback.
      // Count its advancing game-time interval as active play, then classify
      // subsequent frozen result-screen frames as post-match.
      const samplePhase = gameDelta > 0 ? "active-play" : phase;
      if (lastFramePhase !== null && samplePhase !== lastFramePhase) {
        skipNextInterval = true;
      }
      if (
        lastTimestampMs !== null &&
        !skipNextInterval &&
        frame.pageVisible &&
        lastFrameVisible === true &&
        lastFramePhase === samplePhase
      ) {
        if (samplePhase === "active-play") {
          activePlayFrames.add(frame.frameIntervalMs);
          if (simulatedSeconds < 60) firstGameMinute.add(frame.frameIntervalMs);
          if (
            targetDurationSeconds !== null &&
            simulatedSeconds >= Math.max(0, targetDurationSeconds - 60) &&
            simulatedSeconds <= targetDurationSeconds + 1
          ) {
            finalGameMinute.add(frame.frameIntervalMs);
          }
        } else {
          postMatchFrames.add(frame.frameIntervalMs);
        }
      }

      lastTimestampMs = frame.timestampMs;
      lastFrameVisible = frame.pageVisible;
      lastFramePhase = samplePhase;
      skipNextInterval = false;
    },

    recordVisibilityChange(change: LocalPerformanceVisibilityChange) {
      if (!Number.isFinite(change.timestampMs)) return;
      if (visibilityState === change.visible) return;
      if (change.visible) restores += 1;
      else backgrounds += 1;
      visibilityState = change.visible;
      skipNextInterval = true;
    },

    recordMemorySample(gameSeconds: number, reading: BrowserHeapReading | null) {
      if (!Number.isFinite(gameSeconds) || gameSeconds < 0) return;
      if (
        reading === null ||
        !Number.isFinite(reading.usedBytes) ||
        !Number.isFinite(reading.totalBytes) ||
        reading.usedBytes < 0 ||
        reading.totalBytes < reading.usedBytes
      ) {
        heapSamples.push({ gameSeconds: round(gameSeconds), usedMiB: null, totalMiB: null });
        return;
      }
      heapSamples.push({
        gameSeconds: round(gameSeconds),
        usedMiB: round(reading.usedBytes / MEBIBYTE),
        totalMiB: round(reading.totalBytes / MEBIBYTE),
      });
    },

    getLatestGameSeconds() {
      return simulatedSeconds;
    },

    isTargetReached() {
      return isTargetReached();
    },

    recordRoundFinished() {
      if (roundsCompleted < roundsStarted) roundsCompleted += 1;
    },

    beginNextRound() {
      roundsStarted += 1;
      lastRoundGameSeconds = 0;
      lastFramePhase = null;
      lastFrameVisible = null;
      skipNextInterval = true;
    },

    finish(): LocalPerformanceSummary {
      const elapsedWallSeconds = startedAtMs !== null && lastTimestampMs !== null
        ? round(Math.max(0, lastTimestampMs - startedAtMs) / 1000)
        : 0;
      const activeFrameSeconds = round(activePlayFrames.activeSeconds);
      const postMatchFrameSeconds = round(postMatchFrames.activeSeconds);
      return {
        targetGameSeconds: targetDurationSeconds,
        targetReached: targetDurationSeconds === null ? null : isTargetReached(),
        elapsedWallSeconds,
        activeFrameSeconds,
        postMatchFrameSeconds,
        nonSampledWallSeconds: round(Math.max(0, elapsedWallSeconds - activeFrameSeconds - postMatchFrameSeconds)),
        activeGameSeconds: round(simulatedSeconds),
        roundsStarted,
        roundsCompleted,
        activePlayFrames: activePlayFrames.summary(),
        postMatchFrames: postMatchFrames.summary(),
        firstGameMinute: firstGameMinute.summary(),
        finalGameMinute: finalGameMinute.summary(),
        visibility: { backgrounds, restores },
        heap: {
          status: heapSamples.some((sample) => sample.usedMiB !== null) ? "available" : "unavailable",
          samples: [...heapSamples],
        },
        thermalStatus: "Not exposed through standard browser APIs; record any OS warning or throttling separately.",
        method: "requestAnimationFrame callback intervals; an estimate of browser frame cadence, not GPU render timing.",
      };
    },
  };
}

export function readBrowserHeap(): BrowserHeapReading | null {
  try {
    const performanceWithMemory = globalThis.performance as Performance & {
      memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number };
    };
    const memory = performanceWithMemory.memory;
    const usedBytes = memory?.usedJSHeapSize;
    const totalBytes = memory?.totalJSHeapSize;
    if (
      typeof usedBytes !== "number" ||
      typeof totalBytes !== "number" ||
      !Number.isFinite(usedBytes) ||
      !Number.isFinite(totalBytes) ||
      usedBytes < 0 ||
      totalBytes < usedBytes
    ) return null;
    return { usedBytes, totalBytes };
  } catch {
    return null;
  }
}

export function readLocalPerformanceDeviceInfo(): LocalPerformanceDeviceInfo {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      environment: "Browser metadata unavailable",
      chromeVersion: "not detected",
      screenCssPixels: "not available",
      viewportCssPixels: "not available",
      orientationAtStart: "not available",
      devicePixelRatio: 1,
    };
  }

  const chromeVersion = navigator.userAgent.match(/(?:Chrome|Chromium|CriOS)\/([\d.]+)/)?.[1];
  const orientation = window.screen.orientation?.type ??
    (window.innerWidth >= window.innerHeight ? "landscape" : "portrait");
  const isReplitPreview = window.location.hostname.endsWith(".replit.dev");

  return {
    environment: isReplitPreview
      ? "Replit development preview; not Railway staging or Production"
      : "Browser host; verify the environment separately",
    chromeVersion: chromeVersion ? `Chrome ${chromeVersion}` : "Chrome version not detected in browser user-agent",
    screenCssPixels: `${window.screen.width}x${window.screen.height} CSS px`,
    viewportCssPixels: `${window.innerWidth}x${window.innerHeight} CSS px`,
    orientationAtStart: orientation,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}
