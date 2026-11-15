import {
  isProjectileMotionSnapshot, validProjectilePoint, type ProjectileMotionSnapshot,
  type ProjectileMotionSample, type ProjectilePoint,
} from "@workspace/orbital-sim";

export const MAX_PROJECTILE_VISUALS = 160;
export const MAX_PROJECTILE_TRAIL_POINTS = 8;
const MOTION_STALE_MS = 350;
type Sample = { point: ProjectilePoint; tick: number };
type Track = { sample: ProjectileMotionSample; points: Sample[]; receivedAt: number };

/** Interpolates server positions only. Never steers, collides or claims hits. */
export function createSharedProjectileMotion() {
  let sessionId: string | null = null;
  let tick = -1;
  const tracks = new Map<string, Track>();
  const ended = new Map<string, { point: ProjectilePoint; receivedAt: number; points: ProjectilePoint[] }>();
  function clear() { sessionId = null; tick = -1; tracks.clear(); ended.clear(); }
  function accept(value: unknown, expectedSession: string | null, now: number): ProjectileMotionSnapshot | null {
    if (!isProjectileMotionSnapshot(value) || !Number.isFinite(now) ||
        value.sessionInstanceId !== expectedSession) return null;
    if (sessionId !== expectedSession) {
      if (sessionId !== null) clear();
      sessionId = expectedSession;
    }
    if (value.tick <= tick) return null;
    tick = value.tick;
    const live = new Set(value.projectiles.map(p => p.eventId));
    for (const id of tracks.keys()) if (!live.has(id)) tracks.delete(id);
    for (const p of value.projectiles) {
      if (ended.has(p.eventId)) continue;
      const old = tracks.get(p.eventId);
      const points = [...(old?.points ?? []),
        { point: { ...p.previousPosition }, tick: Math.max(0, value.tick - 1) },
        { point: { ...p.position }, tick: value.tick }]
        .slice(-MAX_PROJECTILE_TRAIL_POINTS);
      tracks.set(p.eventId, { sample: p, points, receivedAt: now });
    }
    return value;
  }
  function path(eventId: string, now: number): ProjectilePoint[] | null {
    const contact = ended.get(eventId);
    if (contact) {
      if (now - contact.receivedAt > 280 || now < contact.receivedAt) return null;
      return [...contact.points.slice(-(MAX_PROJECTILE_TRAIL_POINTS - 1)), contact.point];
    }
    const track = tracks.get(eventId);
    if (!track || now < track.receivedAt || now - track.receivedAt > MOTION_STALE_MS) return null;
    const points = track.points;
    // A 100 ms presentation delay buffers two samples. Hold the last confirmed
    // point during a gap instead of continuing a guessed straight missile path.
    const targetTick = points.length <= 2 ? points.at(-1)!.tick
      : points.at(-1)!.tick - 3 + Math.min(100, now - track.receivedAt) * .03;
    const before = [...points].reverse().find(p => p.tick <= targetTick) ?? points[0]!;
    const after = points.find(p => p.tick >= targetTick) ?? points.at(-1)!;
    const alpha = after.tick > before.tick
      ? Math.max(0, Math.min(1, (targetTick - before.tick) / (after.tick - before.tick))) : 0;
    const tip = {
      x: before.point.x + (after.point.x - before.point.x) * alpha,
      y: before.point.y + (after.point.y - before.point.y) * alpha,
      z: before.point.z + (after.point.z - before.point.z) * alpha,
    };
    return [...points.filter(p => p.tick < before.tick).map(p => p.point), before.point, tip]
      .slice(-MAX_PROJECTILE_TRAIL_POINTS);
  }
  function contact(eventId: string, point: unknown, now: number) {
    if (!validProjectilePoint(point) || !Number.isFinite(now) || ended.has(eventId)) return false;
    const confirmed = path(eventId, now) ?? tracks.get(eventId)?.points.map(p => p.point) ?? [];
    ended.set(eventId, { point: { ...point }, receivedAt: now, points: confirmed });
    if (ended.size > 1024) ended.delete(ended.keys().next().value!);
    tracks.delete(eventId);
    return true;
  }
  return { accept, path, contact, clear, hasEnded: (id: string) => ended.has(id),
    get size() { return tracks.size; } };
}

/** Keep trails readable and bounded in metres, not in screen-spanning history. */
export function clipProjectileTrail(points: readonly ProjectilePoint[], length: number): ProjectilePoint[] {
  if (points.length < 2) return [...points, ...points];
  const reversed: ProjectilePoint[] = [{ ...points.at(-1)! }];
  let remaining = Math.max(0, length);
  for (let i = points.length - 2; i >= 0; i--) {
    const to = reversed.at(-1)!, from = points[i]!;
    const distance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    if (distance > remaining && distance > 0) {
      const alpha = remaining / distance;
      reversed.push({ x: to.x + (from.x - to.x) * alpha,
        y: to.y + (from.y - to.y) * alpha, z: to.z + (from.z - to.z) * alpha });
      break;
    }
    reversed.push({ ...from });
    remaining -= distance;
    if (remaining <= 0) break;
  }
  return reversed.reverse().slice(-MAX_PROJECTILE_TRAIL_POINTS);
}
