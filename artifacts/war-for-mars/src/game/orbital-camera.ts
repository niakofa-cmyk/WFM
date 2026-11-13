import { rotate } from "./orbital-flight";
import type { Quaternion } from "./orbital-flight";

export type CameraVector = { x: number; y: number; z: number };

export type OrbitalCameraPose = {
  offset: CameraVector;
  ahead: CameraVector;
  up: CameraVector;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const REFERENCE_ASPECT = 16 / 9;
const REFERENCE_VERTICAL_FOV = 58;
const MIN_VERTICAL_FOV = 38;
const MAX_VERTICAL_FOV = 74;

/**
 * Preserve the same horizontal view across landscape devices. A fixed vertical
 * FOV makes ultra-wide phones show substantially more of the sides than shorter
 * screens, which changes the apparent framing of the shared flight scene.
 */
export function orbitalCameraFov(aspectRatio: number): number {
  const aspect = Number.isFinite(aspectRatio) && aspectRatio > 0
    ? aspectRatio
    : REFERENCE_ASPECT;
  const horizontalHalfFov = Math.tan((REFERENCE_VERTICAL_FOV * Math.PI) / 360) * REFERENCE_ASPECT;
  const verticalFov = (2 * Math.atan(horizontalHalfFov / aspect) * 180) / Math.PI;
  return Math.max(MIN_VERTICAL_FOV, Math.min(MAX_VERTICAL_FOV, verticalFov));
}

function horizonUp(forward: CameraVector): CameraVector {
  const forwardLength = Math.hypot(forward.x, forward.y, forward.z);
  if (!Number.isFinite(forwardLength) || forwardLength < 1e-8) return { x: 0, y: 1, z: 0 };

  const x = forward.x / forwardLength;
  const y = forward.y / forwardLength;
  const z = forward.z / forwardLength;
  let up = { x: -x * y, y: 1 - y * y, z: -z * y };
  let length = Math.hypot(up.x, up.y, up.z);
  if (length < 1e-6) {
    // At a vertical heading, project world-right instead of a parallel world-up.
    up = { x: 1 - x * x, y: -x * y, z: -x * z };
    length = Math.hypot(up.x, up.y, up.z);
  }
  if (!Number.isFinite(length) || length < 1e-8) return { x: 0, y: 1, z: 0 };
  return { x: up.x / length, y: up.y / length, z: up.z / length };
}

function localCameraVector(
  forward: CameraVector,
  up: CameraVector,
  localY: number,
  localZ: number,
): CameraVector {
  return {
    x: forward.x * -localZ + up.x * localY,
    y: forward.y * -localZ + up.y * localY,
    z: forward.z * -localZ + up.z * localY,
  };
}

function blendVector(a: CameraVector, b: CameraVector, amount: number): CameraVector {
  return {
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
    z: a.z + (b.z - a.z) * amount,
  };
}

function normalizedBlend(a: CameraVector, b: CameraVector, amount: number, fallback: CameraVector): CameraVector {
  const blended = blendVector(a, b, amount);
  const length = Math.hypot(blended.x, blended.y, blended.z);
  if (!Number.isFinite(length) || length < 1e-6) return fallback;
  return { x: blended.x / length, y: blended.y / length, z: blended.z / length };
}

/**
 * During a tactical roll, keep the chase/cockpit camera's follow vectors
 * horizon-stabilized so the ship visibly rotates instead of the camera
 * counter-rotating with it. Blend back after the maneuver completes.
 */
export function orbitalCameraPose(
  q: Quaternion,
  cockpit: boolean,
  rollStabilization: number,
): OrbitalCameraPose {
  const amount = clamp01(rollStabilization);
  const forward = rotate(q, 0, 0, -1);
  const stableUp = horizonUp(forward);
  const offsetY = cockpit ? 1.2 : 5;
  const offsetZ = cockpit ? -0.65 : 21;
  const aheadY = cockpit ? 1.2 : 1.1;
  const aheadZ = cockpit ? -40 : -31;
  const rolledOffset = rotate(q, 0, offsetY, offsetZ);
  const rolledAhead = rotate(q, 0, aheadY, aheadZ);
  const rolledUp = rotate(q, 0, 1, 0);
  const stableOffset = localCameraVector(forward, stableUp, offsetY, offsetZ);
  const stableAhead = localCameraVector(forward, stableUp, aheadY, aheadZ);

  return {
    offset: blendVector(rolledOffset, stableOffset, amount),
    ahead: blendVector(rolledAhead, stableAhead, amount),
    up: normalizedBlend(rolledUp, stableUp, amount, stableUp),
  };
}
