const clamp = (x, min = -1, max = 1) => Math.max(min, Math.min(max, x));

/**
 * Bounded staging-driver intent, not gameplay auto-aim. Consumes observed
 * geometry and returns normal device controls; never writes health or results.
 */
export function battlePilotIntent(own, target) {
  const q = own.orientation;
  const dx = target.position.x - own.position.x;
  const dy = target.position.y - own.position.y;
  const dz = target.position.z - own.position.z;
  const x = -q.x, y = -q.y, z = -q.z, w = q.w;
  const tx = 2 * (y * dz - z * dy);
  const ty = 2 * (z * dx - x * dz);
  const tz = 2 * (x * dy - y * dx);
  const local = {
    x: dx + w * tx + y * tz - z * ty,
    y: dy + w * ty + z * tx - x * tz,
    z: dz + w * tz + x * ty - y * tx,
  };
  const yaw = Math.atan2(-local.x, -local.z);
  const pitch = Math.atan2(local.y, Math.hypot(local.x, local.z));
  const distance = Math.hypot(dx, dy, dz);
  return {
    // Device-facing yaw is inverted by Orbital's authority adapter.
    steer: clamp(-yaw * 2.1, -0.9, 0.9),
    stickPitch: clamp(-pitch * 2.1, -0.9, 0.9),
    forward: distance > 45 && Math.abs(yaw) < 0.4 && Math.abs(pitch) < 0.4,
    reverse: distance < 15,
    missile: distance <= 65 && Math.abs(yaw) < 0.12 && Math.abs(pitch) < 0.12,
    distance,
  };
}
