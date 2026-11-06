import { ORBITAL_RULES_VERSION, type FlightControls } from "./flight";

export type OrbitalInput = FlightControls & {
  version: typeof ORBITAL_RULES_VERSION; seq: number; targetId: number | null;
  fire: boolean; missile: boolean; boost: boolean; brake: boolean; inertial: boolean; aimAssist: boolean; countermeasure: boolean;
  vertical: number; roll: number;
};
export const IDLE_ORBITAL: Omit<OrbitalInput, "seq"> = {
  version: ORBITAL_RULES_VERSION, targetId: null,
  throttle: 0, yaw: 0, pitch: 0, strafe: 0, vertical: 0, roll: 0,
   fire: false, missile: false, boost: false, brake: false, inertial: false, aimAssist: false, countermeasure: false,
};
const AXES = ["throttle", "yaw", "pitch", "strafe", "vertical", "roll"] as const;
const BUTTONS = ["fire", "missile", "boost", "brake", "inertial", "aimAssist", "countermeasure"] as const;
const KEYS = new Set<string>(["version", "seq", "targetId", ...AXES, ...BUTTONS]);
export type InputResult = { ok: true; input: OrbitalInput } | { ok: false; reason: "invalid_packet" | "version" | "sequence" };
export function parseOrbitalInput(value: unknown): InputResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, reason: "invalid_packet" };
  const packet = value as Record<string, unknown>;
  if (Object.keys(packet).some((key) => !KEYS.has(key)) || Object.keys(packet).length !== KEYS.size) return { ok: false, reason: "invalid_packet" };
  if (packet.version !== ORBITAL_RULES_VERSION) return { ok: false, reason: "version" };
  if (!Number.isSafeInteger(packet.seq) || (packet.seq as number) < 1 || (packet.seq as number) > 0x7fffffff) return { ok: false, reason: "sequence" };
  if (packet.targetId !== null && (!Number.isSafeInteger(packet.targetId) || (packet.targetId as number) < 1)) return { ok: false, reason: "invalid_packet" };
  for (const key of AXES) {
    const axis = packet[key];
    if (typeof axis !== "number" || !Number.isFinite(axis) || Math.abs(axis) > 1) return { ok: false, reason: "invalid_packet" };
  }
  for (const key of BUTTONS) if (typeof packet[key] !== "boolean") return { ok: false, reason: "invalid_packet" };
  return { ok: true, input: { version: ORBITAL_RULES_VERSION, seq: packet.seq as number, targetId: packet.targetId as number | null,
    throttle: packet.throttle as number, yaw: packet.yaw as number, pitch: packet.pitch as number, strafe: packet.strafe as number,
    vertical: packet.vertical as number, roll: packet.roll as number, fire: packet.fire as boolean, missile: packet.missile as boolean,
     boost: packet.boost as boolean, brake: packet.brake as boolean, inertial: packet.inertial as boolean,
     aimAssist: packet.aimAssist as boolean, countermeasure: packet.countermeasure as boolean } };
}
