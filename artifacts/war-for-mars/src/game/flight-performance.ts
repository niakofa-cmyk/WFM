export type FramePacingWindow = {
  frameCount: number;
  fps: number;
  averageFrameMs: number;
  p95FrameMs: number;
  longFrameCount: number;
};

const FRAME_BUCKET_UPPER_MS = [8, 12, 16.7, 20, 25, 33.3, 50, 100, 250] as const;

/**
 * Allocation-light, local-only frame pacing sampler. It emits one summary
 * window per second and ignores long gaps caused by backgrounding or app swaps.
 */
export class FramePacingMonitor {
  private previousAt: number | null = null;
  private windowStartedAt = 0;
  private frameCount = 0;
  private totalFrameMs = 0;
  private longFrameCount = 0;
  private readonly histogram = new Uint16Array(FRAME_BUCKET_UPPER_MS.length);

  reset(): void {
    this.previousAt = null;
    this.windowStartedAt = 0;
    this.frameCount = 0;
    this.totalFrameMs = 0;
    this.longFrameCount = 0;
    this.histogram.fill(0);
  }

  record(nowMs: number): FramePacingWindow | null {
    if (!Number.isFinite(nowMs)) return null;
    if (this.previousAt === null) {
      this.previousAt = nowMs;
      this.windowStartedAt = nowMs;
      return null;
    }

    const frameMs = nowMs - this.previousAt;
    this.previousAt = nowMs;
    if (frameMs <= 0 || frameMs > 250) {
      this.resetWindow(nowMs);
      return null;
    }

    this.frameCount++;
    this.totalFrameMs += frameMs;
    if (frameMs >= 50) this.longFrameCount++;
    for (let i = 0; i < FRAME_BUCKET_UPPER_MS.length; i++) {
      if (frameMs <= FRAME_BUCKET_UPPER_MS[i]!) {
        this.histogram[i]++;
        break;
      }
    }

    const elapsedMs = nowMs - this.windowStartedAt;
    if (elapsedMs < 1000 || this.frameCount === 0) return null;
    const rank = Math.ceil(this.frameCount * 0.95);
    let cumulative = 0;
    let p95FrameMs = 250;
    for (let i = 0; i < this.histogram.length; i++) {
      cumulative += this.histogram[i]!;
      if (cumulative >= rank) {
        p95FrameMs = FRAME_BUCKET_UPPER_MS[i]!;
        break;
      }
    }

    const result: FramePacingWindow = {
      frameCount: this.frameCount,
      fps: this.frameCount * 1000 / elapsedMs,
      averageFrameMs: this.totalFrameMs / this.frameCount,
      p95FrameMs,
      longFrameCount: this.longFrameCount,
    };
    this.resetWindow(nowMs);
    return result;
  }

  private resetWindow(nowMs: number): void {
    this.windowStartedAt = nowMs;
    this.frameCount = 0;
    this.totalFrameMs = 0;
    this.longFrameCount = 0;
    this.histogram.fill(0);
  }
}

/**
 * Changes render resolution only after sustained frame pressure. Simulation,
 * collision, input cadence, and server authority are intentionally untouched.
 */
export class AdaptiveResolutionController {
  private scale = 1;
  private slowWindows = 0;
  private smoothWindows = 0;
  private lastChangeAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly minimumScale = 0.7) {}

  get currentScale(): number {
    return this.scale;
  }

  update(window: FramePacingWindow, nowMs: number): number | null {
    if (window.frameCount < 20 || !Number.isFinite(nowMs)) return null;
    const slow = window.p95FrameMs >= 25 || window.fps < 45;
    const smooth = window.p95FrameMs <= 18 && window.fps >= 55;
    this.slowWindows = slow ? this.slowWindows + 1 : 0;
    this.smoothWindows = smooth ? this.smoothWindows + 1 : 0;

    if (this.slowWindows >= 2 && nowMs - this.lastChangeAt >= 2000 && this.scale > this.minimumScale) {
      this.scale = Math.max(this.minimumScale, Math.round((this.scale - 0.1) * 100) / 100);
      this.slowWindows = 0;
      this.smoothWindows = 0;
      this.lastChangeAt = nowMs;
      return this.scale;
    }
    if (this.smoothWindows >= 8 && nowMs - this.lastChangeAt >= 8000 && this.scale < 1) {
      this.scale = Math.min(1, Math.round((this.scale + 0.05) * 100) / 100);
      this.smoothWindows = 0;
      this.slowWindows = 0;
      this.lastChangeAt = nowMs;
      return this.scale;
    }
    return null;
  }
}

/** A single outstanding ping keeps the diagnostic independent of game input. */
export class RoundTripProbe {
  private sequence = 0;
  private pendingNonce: number | null = null;
  private sentAt: number | null = null;

  begin(nowMs: number): number | null {
    if (!Number.isFinite(nowMs) || this.pendingNonce !== null) return null;
    this.sequence = this.sequence >= 2_147_483_647 ? 1 : this.sequence + 1;
    this.pendingNonce = this.sequence;
    this.sentAt = nowMs;
    return this.sequence;
  }

  accept(nonce: number, nowMs: number): number | null {
    if (this.pendingNonce !== nonce || this.sentAt === null || !Number.isFinite(nowMs)) return null;
    const elapsed = nowMs - this.sentAt;
    this.pendingNonce = null;
    this.sentAt = null;
    return elapsed >= 0 && elapsed <= 10_000 ? Math.round(elapsed) : null;
  }

  expire(nowMs: number, timeoutMs = 5000): void {
    if (this.sentAt !== null && nowMs - this.sentAt > timeoutMs) {
      this.pendingNonce = null;
      this.sentAt = null;
    }
  }

  clear(): void {
    this.pendingNonce = null;
    this.sentAt = null;
  }
}
