import type { FlightControls } from "./flight";
/** Shared geometry and damage rules; only the authoritative runtime mutates health. */
export const SHIP_SUBSYSTEMS = [
  "engines", "weapons", "missiles", "shields", "sensors", "communications", "reactor", "bridge",
] as const;
export type ShipSubsystem = typeof SHIP_SUBSYSTEMS[number];
export type ShipSubsystemState = {
  version: 1;
  health: Record<ShipSubsystem, number>;
  maximum: number;
};
export const SUBSYSTEM_LABELS: Record<ShipSubsystem, string> = {
  engines: "ENGINES", weapons: "CANNONS", missiles: "LAUNCHERS", shields: "SHIELDS",
  sensors: "SENSORS", communications: "COMMS", reactor: "REACTOR", bridge: "BRIDGE",
};
// Hull-relative attachment regions: forward is -Z, exhaust is +Z.
export const SUBSYSTEM_OFFSETS: Record<ShipSubsystem, { x: number; y: number; z: number }> = {
  engines: { x: 0, y: 0, z: .9 },
  weapons: { x: -.7, y: -.2, z: -.5 },
  missiles: { x: .7, y: -.2, z: -.5 },
  shields: { x: -.9, y: .1, z: .2 },
  sensors: { x: 0, y: .2, z: -.95 },
  communications: { x: .6, y: .65, z: .2 },
  reactor: { x: .15, y: -.85, z: .15 },
  bridge: { x: 0, y: .85, z: -.25 },
};
export function newShipSubsystems(hullMax: number): ShipSubsystemState {
  const maximum = Math.max(1, hullMax * .18);
  return { version: 1, maximum,
    health: Object.fromEntries(SHIP_SUBSYSTEMS.map(id => [id, maximum])) as Record<ShipSubsystem, number> };
}
export function isShipSubsystem(value: unknown): value is ShipSubsystem {
  return typeof value === "string" && (SHIP_SUBSYSTEMS as readonly string[]).includes(value);
}
export function validShipSubsystems(value: unknown): value is ShipSubsystemState {
  if (!value || typeof value !== "object") return false;
  const s = value as ShipSubsystemState;
  return Object.keys(s).length === 3 && s.version === 1 &&
    Number.isFinite(s.maximum) && s.maximum > 0 && s.maximum <= 1000 &&
    !!s.health && Object.keys(s.health).length === SHIP_SUBSYSTEMS.length &&
    SHIP_SUBSYSTEMS.every(id => Number.isFinite(s.health[id]) && s.health[id] >= 0 && s.health[id] <= s.maximum);
}
export function subsystemEfficiency(state: ShipSubsystemState | undefined, id: ShipSubsystem): number {
  return state ? state.health[id] / state.maximum : 1;
}
/** Prediction and authority use identical damage-to-control mapping. Raw input stays unmodified on the wire. */
export function subsystemFlightControls<T extends FlightControls>(input: T, state?: ShipSubsystemState): T {
  const engines = subsystemEfficiency(state, "engines");
  const power = subsystemEfficiency(state, "reactor");
  return { ...input, throttle: input.throttle * engines, strafe: input.strafe * engines,
    vertical: (input.vertical ?? 0) * engines,
    boost: Boolean(input.boost && engines > .25 && power > .25),
    yaw: input.yaw * (.3 + .7 * engines), pitch: input.pitch * (.3 + .7 * engines) };
}
/** Nearest attachment to a real, hull-local projectile contact, not client-selected damage. */
export function subsystemAtContact(local: { x: number; y: number; z: number }): ShipSubsystem {
  return [...SHIP_SUBSYSTEMS].sort((a, b) => {
    const distance = (id: ShipSubsystem) => {
      const p = SUBSYSTEM_OFFSETS[id];
      return (p.x - local.x) ** 2 + (p.y - local.y) ** 2 + (p.z - local.z) ** 2;
    };
    return distance(a) - distance(b);
  })[0]!;
}
export function damageShipSubsystem(state: ShipSubsystemState, id: ShipSubsystem, damage: number) {
  if (!Number.isFinite(damage) || damage <= 0) return false;
  const before = state.health[id];
  state.health[id] = Math.max(0, before - damage);
  return before > 0 && state.health[id] === 0;
}
export type ShipSubsystemTelemetry = {
  type: "freeflight_subsystem_state"; protocol: 1; sessionInstanceId: string;
  tick: number; actorId: string; own: ShipSubsystemState;
  targetActorId: string | null; target: ShipSubsystemState | null;
  selected: ShipSubsystem | null; targetRadius: number;
};
export function isShipSubsystemTelemetry(value: unknown): value is ShipSubsystemTelemetry {
  if (!value || typeof value !== "object") return false;
  const v = value as ShipSubsystemTelemetry;
  return v.type === "freeflight_subsystem_state" && v.protocol === 1 &&
    typeof v.sessionInstanceId === "string" && typeof v.actorId === "string" &&
    Number.isSafeInteger(v.tick) && v.tick >= 0 && validShipSubsystems(v.own) &&
    (v.targetActorId === null ? v.target === null : typeof v.targetActorId === "string" && validShipSubsystems(v.target)) &&
    (v.selected === null || isShipSubsystem(v.selected)) &&
    Number.isFinite(v.targetRadius) && v.targetRadius >= 0 && v.targetRadius <= 1000;
}
