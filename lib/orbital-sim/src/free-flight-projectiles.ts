/** Presentation-only samples; these never accept or grant damage or rewards. */
export const PROJECTILE_MOTION_PROTOCOL = 1;
export const MAX_PROJECTILE_MOTION_SAMPLES = 96;
export const PROJECTILE_MOTION_INTERVAL_TICKS = 3;
export type ProjectilePoint = { x: number; y: number; z: number };
export type ProjectileMotionSample = {
  eventId: string;
  sourceFaction: "ussf" | "accord";
  visualEffect: "beam" | "pulse" | "heavy" | "precision" | "ion" | "swarm";
  missile: boolean;
  position: ProjectilePoint;
  previousPosition: ProjectilePoint;
  velocity: ProjectilePoint;
  remainingSeconds: number;
};
export type ProjectileMotionSnapshot = {
  protocol: 1;
  sessionInstanceId: string;
  tick: number;
  projectiles: ProjectileMotionSample[];
};
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: readonly string[]) =>
  Object.keys(v).length === allowed.length && Object.keys(v).every(k => allowed.includes(k));
export const validProjectilePoint = (p: unknown, bound = 1e15): p is ProjectilePoint =>
  object(p) && keys(p, ["x", "y", "z"]) &&
  [p.x, p.y, p.z].every(n => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= bound);
export function isProjectileMotionSnapshot(value: unknown): value is ProjectileMotionSnapshot {
  if (!object(value) || !keys(value, ["protocol", "sessionInstanceId", "tick", "projectiles"]) ||
      value.protocol !== PROJECTILE_MOTION_PROTOCOL ||
      typeof value.sessionInstanceId !== "string" || value.sessionInstanceId.length < 1 || value.sessionInstanceId.length > 80 ||
      !Number.isSafeInteger(value.tick) || (value.tick as number) < 0 ||
      !Array.isArray(value.projectiles) || value.projectiles.length > MAX_PROJECTILE_MOTION_SAMPLES) return false;
  const ids = new Set<string>();
  return value.projectiles.every(p => {
    if (!object(p) || !keys(p, ["eventId", "sourceFaction", "visualEffect", "missile", "position", "previousPosition", "velocity", "remainingSeconds"]) ||
        typeof p.eventId !== "string" || p.eventId.length > 160 ||
        !p.eventId.startsWith(`${value.sessionInstanceId}:projectile:`) || ids.has(p.eventId) ||
        !["ussf", "accord"].includes(p.sourceFaction as string) ||
        !["beam", "pulse", "heavy", "precision", "ion", "swarm"].includes(p.visualEffect as string) ||
        typeof p.missile !== "boolean" || !validProjectilePoint(p.position) || !validProjectilePoint(p.previousPosition) ||
        !validProjectilePoint(p.velocity, 1e6) || typeof p.remainingSeconds !== "number" ||
        !Number.isFinite(p.remainingSeconds) || p.remainingSeconds <= 0 || p.remainingSeconds > 60) return false;
    ids.add(p.eventId);
    return true;
  });
}
