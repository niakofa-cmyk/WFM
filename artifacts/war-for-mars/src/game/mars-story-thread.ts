/**
 * Navigation-only relationship between existing WFM story identities and the
 * Mars route atlas. This is not an operation catalog or authority source.
 */
export type MarsStoryBeat = {
  id: string;
  routeId: string;
  title: string;
  role: "campaign-beat" | "travel-bridge" | "future-reveal";
  campaignSortieId?: "contact" | "beacon" | "warden" | "cage";
  purpose: string;
  connection: string;
};

export const MARS_STORY_THREAD: readonly MarsStoryBeat[] = [
  {
    id: "contact",
    routeId: "rust-disc",
    title: "Contact · The Silent Frontier",
    role: "campaign-beat",
    campaignSortieId: "contact",
    purpose: "Recover the relay route key and learn why the signal is more than a distress call.",
    connection: "The route key points onward to the muted beacon chain.",
  },
  {
    id: "mars-approach",
    routeId: "mars-approach",
    title: "Mars Approach · Arrival Corridor",
    role: "travel-bridge",
    purpose: "Enter the Mars theater and choose where to investigate, patrol, or seek support.",
    connection: "A geographic travel link, not a new campaign progression gate.",
  },
  {
    id: "beacon",
    routeId: "pale-beacons",
    title: "Beacon · The Silent Relay Chain",
    role: "campaign-beat",
    campaignSortieId: "beacon",
    purpose: "Trace the signal and discover who kept the receivers dark.",
    connection: "The relay evidence points toward the night-side command ship.",
  },
  {
    id: "warden",
    routeId: "night-side-station",
    title: "Warden · The Night-side Blockade",
    role: "campaign-beat",
    campaignSortieId: "warden",
    purpose: "Investigate the blackout, identify the blockade's purpose, and recover its record.",
    connection: "The Warden record reveals the moving Cage and Eon Dusk.",
  },
  {
    id: "cage",
    routeId: "dust-lane",
    title: "Cage · The Eon Dusk Extraction",
    role: "campaign-beat",
    campaignSortieId: "cage",
    purpose: "Confront the transport through a faction- and operation-specific objective.",
    connection: "The recorder connects the conflict to a signal beneath Mars.",
  },
  {
    id: "beyond-signal",
    routeId: "below-the-signal",
    title: "Below the Signal · Wider-Universe Thread",
    role: "future-reveal",
    purpose: "Pursue the recovered signal into future physical regions when those environments exist.",
    connection: "A proposed expansion bridge; subsurface exploration is not yet playable.",
  },
] as const;

export const MARS_PARALLEL_STORY_OPERATIONS = [
  {
    id: "iron-eclipse",
    routeId: "iron-eclipse",
    title: "Iron Eclipse · Parallel Warfront",
    chronologyStatus: "unresolved" as const,
    note: "Keep its current operation identity; reconcile its canonical story placement before inserting it into the campaign sequence.",
  },
] as const;

export const MARS_STORY_ROLE_LABEL: Record<MarsStoryBeat["role"], string> = {
  "campaign-beat": "EXISTING CAMPAIGN BEAT",
  "travel-bridge": "TRAVEL BRIDGE",
  "future-reveal": "PROPOSED STORY REVEAL",
};
