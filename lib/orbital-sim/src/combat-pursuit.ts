import { detAtan2, detHypot } from "./detmath";
import { rotate, type SpatialCraft } from "./flight";

/**
 * Training and shared-flight combat use the same ship-local pursuit axes and
 * role spacing. Detection, engagement permission and firing stay with callers.
 */
export function orbitalCombatPursuit(
  craft: SpatialCraft,
  target: SpatialCraft,
  role: string,
  fleetRules = true,
) {
  if (!craft.space || !target.space) throw new Error("Combat pursuit requires spatial flight state.");
  const q = craft.space.q;
  const dx = target.x - craft.x;
  const dy = target.space.y - craft.space.y;
  const dz = target.z - craft.z;
  const local = rotate([-q[0], -q[1], -q[2], q[3]], dx, dy, dz);
  // Preserve training's world-space hypot order at exact stand-off thresholds.
  const distance = detHypot(detHypot(dx, dy), dz);
  const name = role.toLowerCase();
  const heavy = name.includes("heavy") || name.includes("siege");
  const preferredDistance = !fleetRules ? 35
    : name.includes("support") || name.includes("escort") ? 30
      : heavy ? 36 : name.includes("striker") ? 23 : 18;
  return {
    distance,
    controls: {
      yaw: Math.max(-1, Math.min(1, detAtan2(-local.x, -local.z) * 1.7)),
      pitch: Math.max(-1, Math.min(1, detAtan2(local.y, detHypot(local.x, local.z)) * 1.7)),
      throttle: distance > preferredDistance ? 0.4 : distance < preferredDistance * 0.55 ? -0.3 : 0,
      strafe: fleetRules && !heavy ? (craft.id % 2 === 0 ? 1 : -1) * 0.16 : 0,
      vertical: 0,
    },
  };
}
