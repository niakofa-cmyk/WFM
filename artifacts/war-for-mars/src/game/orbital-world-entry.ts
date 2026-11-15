import type { UniverseStartLocation } from "./orbital-universe-session";

/**
 * Only world locations with a real position in the current Orbital scene may
 * be used as authenticated resume points. Unknown locations fail closed.
 */
const SERVER_LOCATION_ANCHORS: Readonly<Record<string, UniverseStartLocation>> = {
  "phobos-yard": "mars-orbit",
  "cinder-asteroid": "cinder-ring",
  "rust-disc": "rust-disc",
  "night-side": "mars-night-side",
};

export function orbitalStartForVerifiedWorldLocation(
  locationId: string | null | undefined,
): UniverseStartLocation | null {
  if (!locationId) return null;
  return SERVER_LOCATION_ANCHORS[locationId] ?? null;
}
