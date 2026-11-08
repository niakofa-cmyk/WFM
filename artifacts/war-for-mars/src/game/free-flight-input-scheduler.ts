import type { FlightControlFrame } from "@workspace/orbital-sim";

/** The socket accepts at most 35 control packets per second; leave headroom. */
export const FREE_FLIGHT_CONTROL_SEND_INTERVAL_MS = 50;

/** Samples continuous controls at 20Hz and preserves short fire/missile taps. */
export class FreeFlightInputScheduler {
  private lastSentAt = Number.NEGATIVE_INFINITY;
  private pendingFire = false;
  private pendingMissile = false;
  private pendingCountermeasure = false;
  private pendingInertial = false;
  private pendingAimAssist = false;

  next(controls: FlightControlFrame, nowMs: number): FlightControlFrame | null {
    if (!Number.isFinite(nowMs)) return null;
    this.pendingFire ||= controls.fire;
    this.pendingMissile ||= controls.missile;
    this.pendingCountermeasure ||= controls.countermeasure;
    this.pendingInertial ||= controls.inertial;
    this.pendingAimAssist ||= controls.aimAssist;
    if (nowMs - this.lastSentAt < FREE_FLIGHT_CONTROL_SEND_INTERVAL_MS) return null;

    this.lastSentAt = nowMs;
    const sampled = {
      ...controls,
      fire: controls.fire || this.pendingFire,
      missile: controls.missile || this.pendingMissile,
      countermeasure: controls.countermeasure || this.pendingCountermeasure,
      inertial: this.pendingInertial,
      aimAssist: this.pendingAimAssist,
    };
    this.pendingFire = false;
    this.pendingMissile = false;
    this.pendingCountermeasure = false;
    this.pendingInertial = false;
    this.pendingAimAssist = false;
    return sampled;
  }

  reset() {
    this.lastSentAt = Number.NEGATIVE_INFINITY;
    this.pendingFire = false;
    this.pendingMissile = false;
    this.pendingCountermeasure = false;
    this.pendingInertial = false;
    this.pendingAimAssist = false;
  }
}
