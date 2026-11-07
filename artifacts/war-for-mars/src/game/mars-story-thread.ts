/**
 * Navigation-only relationship between existing WFM story identities and the
 * Mars route atlas. This is not an operation catalog or authority source.
 */
export type MarsStoryBeat = {
  id: string;
  routeId: string;
  title: string;
  role: "campaign-beat" | "travel-bridge" | "proposed-operation" | "future-reveal";
  sequenceLabel: string;
  campaignSortieId?: "contact" | "beacon" | "warden" | "cage";
  purpose: string;
  connection: string;
};

export const MARS_STORY_FOUNDATION = {
  heading: "The man who wanted Mars",
  premise:
    "Eon Dusk builds a private expedition to claim Mars. The Accord destroys his fleet and captures him; a transmission carries that news to Earth and ignites a conflict shaped by competing human powers.",
  mystery:
    "The First Witness and the signal connect the war to a history neither faction fully understands. Their relationship is revealed gradually through evidence and play.",
  truths: [
    {
      label: "PUBLIC ACCOUNT",
      text: "A human expedition is lost, its leader is captured, and Earth demands a response.",
    },
    {
      label: "POWER NETWORKS",
      text: "Dusk tried to seize Mars; allies and institutions hold different information and pursue competing aims.",
    },
    {
      label: "THE UNKNOWN",
      text: "Mars, the Accord, the signal, and The First Witness point beyond the war's immediate cause.",
    },
  ],
} as const;

export const MARS_STORY_THREAD: readonly MarsStoryBeat[] = [
  {
    id: "contact",
    routeId: "rust-disc",
    title: "Contact · The Silent Frontier",
    role: "campaign-beat",
    sequenceLabel: "CHAPTER I · OPENING",
    campaignSortieId: "contact",
    purpose: "Recover the relay route key and learn why the signal is more than a distress call.",
    connection: "The route key points onward to the muted beacon chain.",
  },
  {
    id: "mars-approach",
    routeId: "mars-approach",
    title: "Mars Approach · Arrival Corridor",
    role: "travel-bridge",
    sequenceLabel: "CHAPTER II · TRAVEL INTERLUDE",
    purpose: "Enter the Mars theater and choose where to investigate, patrol, or seek support.",
    connection: "A geographic travel link, not a new campaign progression gate.",
  },
  {
    id: "beacon",
    routeId: "pale-beacons",
    title: "Beacon · The Silent Relay Chain",
    role: "campaign-beat",
    sequenceLabel: "CHAPTER III · INVESTIGATION",
    campaignSortieId: "beacon",
    purpose: "Trace the signal and discover who kept the receivers dark.",
    connection: "The relay evidence points toward the night-side command ship.",
  },
  {
    id: "warden",
    routeId: "night-side-station",
    title: "Warden · The Night-side Blockade",
    role: "campaign-beat",
    sequenceLabel: "CHAPTER IV · BLACKOUT",
    campaignSortieId: "warden",
    purpose: "Investigate the blackout, identify the blockade's purpose, and recover its record.",
    connection: "The Warden record reveals the moving Cage and Eon Dusk.",
  },
  {
    id: "cage",
    routeId: "dust-lane",
    title: "Cage · The Eon Dusk Extraction",
    role: "campaign-beat",
    sequenceLabel: "CHAPTER V · EXTRACTION",
    campaignSortieId: "cage",
    purpose: "Confront the transport through a faction- and operation-specific objective.",
    connection: "The recorder connects the conflict to a signal beneath Mars.",
  },
  {
    id: "iron-eclipse",
    routeId: "iron-eclipse",
    title: "Iron Eclipse · The Fleet Offensive",
    role: "proposed-operation",
    sequenceLabel: "CHAPTER VI · FLEET OPERATION",
    purpose: "Bring the exposed Mars signal into the wider USSF–Accord fleet conflict.",
    connection: "Proposed strategic bridge after Cage; the operation's exact cause and consequence still need authorship.",
  },
  {
    id: "beyond-signal",
    routeId: "below-the-signal",
    title: "Beyond the Signal · Wider-Universe Thread",
    role: "future-reveal",
    sequenceLabel: "CHAPTER VII · FUTURE REVEAL",
    purpose: "Pursue the recovered signal into future physical regions when those environments exist.",
    connection: "A proposed expansion bridge; subsurface exploration is not yet playable.",
  },
] as const;

export const MARS_STORY_ROLE_LABEL: Record<MarsStoryBeat["role"], string> = {
  "campaign-beat": "EXISTING CAMPAIGN BEAT",
  "travel-bridge": "TRAVEL BRIDGE",
  "proposed-operation": "PROPOSED STORY POSITION",
  "future-reveal": "PROPOSED STORY REVEAL",
};
