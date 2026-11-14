/** Positions are absolute shared-celestial coordinates, never renderer-local. */
export const SALVAGE_RECOVERY_METERS = 60;
export const MAX_WRECK_PACKAGES = 128;
export type WreckPackage = {
  id: string;
  encounterId: string;
  actorId: string;
  ownerUserId: string | null;
  position: { x: number; y: number; z: number };
  status: "pending" | "available" | "recovered";
};
export type SalvageContact = {
  id: string;
  position: WreckPackage["position"];
  distanceMeters: number;
  recoverable: boolean;
};
export function validWreckPackages(value: unknown): value is WreckPackage[] {
  if (!Array.isArray(value) || value.length > MAX_WRECK_PACKAGES) return false;
  const ids = new Set<string>();
  return value.every(p => {
    if (!p || typeof p !== "object" || typeof p.id !== "string" || p.id.length > 400 ||
        typeof p.encounterId !== "string" || !p.encounterId.length || p.encounterId.length > 160 ||
        typeof p.actorId !== "string" || !p.actorId.length || p.actorId.length > 160 ||
        p.id !== `${p.encounterId}:${p.actorId}` || ids.has(p.id) ||
        !(p.ownerUserId === null || typeof p.ownerUserId === "string" && p.ownerUserId.length > 0) ||
        !["pending", "available", "recovered"].includes(p.status) ||
        p.status === "available" && !p.ownerUserId ||
        !p.position || !["x", "y", "z"].every(k => Number.isFinite(p.position[k]) && Math.abs(p.position[k]) <= 1e15)) return false;
    ids.add(p.id);
    return true;
  });
}
export function salvageInReach(position: WreckPackage["position"], wreck: WreckPackage): boolean {
  return Math.hypot(position.x - wreck.position.x, position.y - wreck.position.y,
    position.z - wreck.position.z) <= SALVAGE_RECOVERY_METERS;
}
export function readSalvageContacts(value: unknown): SalvageContact[] | null {
  if (!Array.isArray(value) || value.length > MAX_WRECK_PACKAGES) return null;
  const ids = new Set<string>();
  if (!value.every(p => p && typeof p.id === "string" && p.id.length > 0 && p.id.length <= 400 &&
      !ids.has(p.id) && (ids.add(p.id), true) && typeof p.recoverable === "boolean" &&
      Number.isFinite(p.distanceMeters) && p.distanceMeters >= 0 && p.distanceMeters <= 2500 &&
      p.position && ["x", "y", "z"].every(k => Number.isFinite(p.position[k]) && Math.abs(p.position[k]) <= 1e15))) return null;
  return value as SalvageContact[];
}
