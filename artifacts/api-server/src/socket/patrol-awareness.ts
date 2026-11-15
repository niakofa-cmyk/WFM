/** Bounded server-only sensor memory. Never follows an undetected live pose. */
export type ScoutPoint = { x: number; y: number; z: number };
export type ScoutMemory = {
  actorId: string;
  position: ScoutPoint;
  seenAt: number;
  mode: "tracking" | "searching";
};
export const SCOUT_SENSOR_METERS = 520;
export const SCOUT_MEMORY_SECONDS = 45;
type Candidate = {
  actorId: string; position: ScoutPoint; hostile: boolean;
  alive: boolean; connected: boolean; concealed: boolean;
};
const distance = (a: ScoutPoint, b: ScoutPoint) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function updateScoutMemory(
  origin: ScoutPoint, previous: ScoutMemory | undefined,
  candidates: readonly Candidate[], now: number,
): ScoutMemory | undefined {
  const detected = candidates.filter((pilot) =>
    pilot.hostile && pilot.alive && pilot.connected && !pilot.concealed &&
    distance(origin, pilot.position) <= SCOUT_SENSOR_METERS);
  // Retain the tracked target rather than oscillating between nearby pilots.
  const target = detected.find((pilot) => pilot.actorId === previous?.actorId) ??
    detected.sort((a, b) => distance(origin, a.position) - distance(origin, b.position) ||
      a.actorId.localeCompare(b.actorId))[0];
  if (target) return {
    actorId: target.actorId, position: { ...target.position }, seenAt: now, mode: "tracking",
  };
  if (!previous || now - previous.seenAt >= SCOUT_MEMORY_SECONDS ||
      candidates.some((pilot) => pilot.actorId === previous.actorId && !pilot.alive)) return undefined;
  return { ...previous, mode: "searching" };
}

/** Search a fixed area around the last observation, never the hidden current pose. */
export function scoutDestination(memory: ScoutMemory, now: number): ScoutPoint {
  if (memory.mode === "tracking") return memory.position;
  const elapsed = Math.max(0, now - memory.seenAt);
  const radius = Math.min(100, elapsed * 4);
  return {
    x: memory.position.x + Math.sin(elapsed * 0.4) * radius,
    y: memory.position.y,
    z: memory.position.z + Math.cos(elapsed * 0.4) * radius,
  };
}
