import { equipmentDefinition } from "@workspace/orbital-sim";

export const MAX_PENDING_MOUNT_FIRES = 128;
export const MAX_SEEN_MOUNT_FIRES = 512;
export const MOUNT_FIRE_MAX_AGE_MS = 180;
export type MountedFireEvent = { eventId: string; actorId: string; weaponId: string; receivedAt: number };

/** Presentation-only launch queue. Motion snapshots are deliberately not launch events. */
export function createMountedFireQueue() {
  let session: string | null = null;
  const pending = new Map<string, MountedFireEvent>();
  const seen = new Set<string>();
  function clear() { pending.clear(); seen.clear(); session = null; }
  function scope(id: string | null) {
    if (session !== id) { clear(); session = id; }
  }
  return {
    clear,
    accept(packet: Record<string, unknown>, id: string | null, now: number) {
      scope(id);
      if (!id || !Number.isFinite(now) || now < 0 || packet.type !== "freeflight_weapon_fired" ||
          typeof packet.eventId !== "string" || packet.eventId.length > 200 ||
          !packet.eventId.startsWith(`${id}:`) || packet.eventId.length <= id.length + 1 ||
          typeof packet.sourceActorId !== "string" || !packet.sourceActorId.length || packet.sourceActorId.length > 160 ||
          typeof packet.weaponId !== "string") return false;
      const kind = equipmentDefinition(packet.weaponId)?.kind;
      if ((kind !== "primary" && kind !== "secondary") || seen.has(packet.eventId)) return false;
      seen.add(packet.eventId);
      if (seen.size > MAX_SEEN_MOUNT_FIRES) seen.delete(seen.values().next().value!);
      pending.set(packet.eventId, { eventId: packet.eventId, actorId: packet.sourceActorId,
        weaponId: packet.weaponId, receivedAt: now });
      if (pending.size > MAX_PENDING_MOUNT_FIRES) pending.delete(pending.keys().next().value!);
      return true;
    },
    process(now: number, id: string | null, fire: (event: MountedFireEvent) => boolean) {
      scope(id);
      if (!Number.isFinite(now)) return;
      for (const [key, event] of pending) {
        if (now < event.receivedAt || now - event.receivedAt > MOUNT_FIRE_MAX_AGE_MS || fire(event)) pending.delete(key);
      }
    },
    get pendingCount() { return pending.size; },
    get seenCount() { return seen.size; },
  };
}
