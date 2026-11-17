export type TargetMarkerPlacement = {
  visible: boolean;
  edge: boolean;
  left: number;
  top: number;
  angleDegrees: number;
};

/** Maps a Three.js NDC target into the flight overlay, clamping off-screen contacts to the edge. */
export function targetMarkerPlacement(
  ndc: { x: number; y: number; z: number },
  width: number,
  height: number,
  margin = 42,
): TargetMarkerPlacement {
  if (![ndc.x, ndc.y, ndc.z, width, height, margin].every(Number.isFinite) ||
      width <= margin * 2 || height <= margin * 2) {
    return { visible: false, edge: false, left: 0, top: 0, angleDegrees: 0 };
  }
  const behind = ndc.z > 1;
  const x = (behind ? -ndc.x : ndc.x) * width / 2;
  const y = (behind ? ndc.y : -ndc.y) * height / 2;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const edge = behind || ndc.z < -1 || ndc.z > 1 ||
    Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1;
  if (!edge) {
    return {
      visible: true, edge: false,
      left: halfWidth + x, top: halfHeight + y, angleDegrees: 0,
    };
  }
  let dx = x;
  let dy = y;
  if (Math.hypot(dx, dy) < 1e-6) dy = behind ? -1 : 1;
  const scaleX = (halfWidth - margin) / Math.max(1, Math.abs(dx));
  const scaleY = (halfHeight - margin) / Math.max(1, Math.abs(dy));
  const scale = Math.min(scaleX, scaleY);
  return {
    visible: true,
    edge: true,
    left: halfWidth + dx * scale,
    top: halfHeight + dy * scale,
    angleDegrees: Math.atan2(dy, dx) * 180 / Math.PI,
  };
}
