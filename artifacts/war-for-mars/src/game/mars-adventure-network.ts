/**
 * Source-backed route atlas for the Orbital universe entry.
 *
 * This is a navigation/design catalog, not an operation directory. A row marked
 * retired or planned routes cannot be launched through the current native
 * Cinder Ring scene and do not imply a live event, shared presence, or reward.
 */
export type MarsAdventureState = "orbital-local" | "retired" | "planned";

export type MarsAdventure = {
  id: string;
  name: string;
  region: string;
  state: MarsAdventureState;
  concept: string;
  currentEvidence: string;
  nextGate: string;
};

export const MARS_ADVENTURES: readonly MarsAdventure[] = [
  {
    id: "mars-orbit",
    name: "Mars Orbit",
    region: "Departure theatre",
    state: "retired",
    concept: "Fly the local Orbital sector and discover nearby generated space.",
    currentEvidence: "Bounded offline session; no persistent world position or rewards.",
    nextGate: "Planetary frames, rotation, and continuous orbit-to-surface navigation.",
  },
  {
    id: "cinder-ring",
    name: "Cinder Ring",
    region: "Asteroid station",
    state: "orbital-local",
    concept: "Approach and dock at the physical station inside the same local flight.",
    currentEvidence: "Local docking and station training; account travel and match admission stay server-owned.",
    nextGate: "Server-approved travel plus real public battle discovery and authorized entry.",
  },
  {
    id: "rust-disc",
    name: "Rust Disc",
    region: "Frontier debris field",
    state: "retired",
    concept: "Relay recovery, patrol encounters, salvage, and extraction.",
    currentEvidence: "The server-run expedition can persist the relay record after server-verified recovery; offline local recovery remains unsynced, and the operation stays on its separate server-run path.",
    nextGate: "Migrate the operation runtime and settlement through an Orbital adapter with authority and rollback proof.",
  },
  {
    id: "mars-approach",
    name: "Mars Approach",
    region: "Orbital arrival corridor",
    state: "retired",
    concept: "Survey traffic, discover access corridors, and prepare for planetary entry.",
    currentEvidence: "Existing mission content does not provide an Orbital atmosphere transition.",
    nextGate: "Shared planetary coordinates and continuous orbit/atmosphere handoff.",
  },
  {
    id: "pale-beacons",
    name: "Pale Beacons",
    region: "Outer signal chain",
    state: "retired",
    concept: "Triangulate a signal, investigate an anomaly, and report a discovery.",
    currentEvidence: "Existing server-run mission path; not an open-world roaming event.",
    nextGate: "Versioned Orbital encounter adapter with server-owned discovery and settlement.",
  },
  {
    id: "iron-eclipse",
    name: "Iron Eclipse",
    region: "Contested Mars orbit",
    state: "retired",
    concept: "Discover a fleet engagement, attack objectives, and extract.",
    currentEvidence: "Existing server-run operation remains its own supported path.",
    nextGate: "Authorized in-world event discovery and a verified Orbital operation handoff.",
  },
  {
    id: "night-side-station",
    name: "Night-side Station",
    region: "Fixed dark-hemisphere orbit",
    state: "planned",
    concept: "Approach and dock at the night-side installation.",
    currentEvidence: "The station can be physically approached and locally docked; Mars does not rotate and no surface traversal or rescue operation is implemented.",
    nextGate: "Shared planetary clock, dynamic day/night rotation, and continuous orbit-to-surface travel.",
  },
  {
    id: "dust-lane",
    name: "Dust Lane",
    region: "Equatorial transfer corridor",
    state: "planned",
    concept: "Track a convoy through debris, then escort, intercept, or salvage.",
    currentEvidence: "No live convoy actors or world encounter director.",
    nextGate: "Server-owned faction actors, encounter lifecycle, and validated operation results.",
  },
  {
    id: "below-the-signal",
    name: "Below the Signal",
    region: "Subsurface anomaly frontier",
    state: "planned",
    concept: "Investigate a deep signal through a cooperative research expedition.",
    currentEvidence: "No persistent anomaly expedition is implemented.",
    nextGate: "Validated anomaly traversal mechanics, shared state, and settlement contract.",
  },
  {
    id: "phobos-yard",
    name: "Phobos Yard",
    region: "Phobos orbital infrastructure",
    state: "planned",
    concept: "Refit, trade, form a squadron, and dispatch to nearby operations.",
    currentEvidence: "No in-world shipyard destination; existing account services are separate.",
    nextGate: "Physical location plus authenticated service integration and server-side travel.",
  },
  {
    id: "outer-fringe",
    name: "Outer Fringe",
    region: "Remote Mars system",
    state: "planned",
    concept: "Explore remote sectors and encounter opposing-faction traffic.",
    currentEvidence: "Address-based local sector generation is not persistent planetary geography or multiplayer presence.",
    nextGate: "Server-approved streaming, faction encounter authority, and reconnect-safe travel.",
  },
] as const;

export const MARS_ADVENTURE_STATE_LABEL: Record<MarsAdventureState, string> = {
  "orbital-local": "CURRENT ORBITAL-NATIVE SLICE",
  retired: "LEGACY PRESENTATION RETIRED",
  planned: "PLANNED · NOT LIVE",
};
