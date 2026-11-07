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
  heading: "The tycoon who tried to take Mars",
  premise:
    "Scandal-enriched billionaire Eon Dusk manipulates powerful insiders and uses USSF support to assemble his own force for a secret Mars seizure. The Accord destroys his fleet; Dusk, its only known survivor, is captured. A transmission reaches Earth before the fleet is lost and reports his capture, igniting a crisis and the USSF–Accord war.",
  dusk:
    "Dusk is not a serving USSF commander or a willing truth-teller. He believes humanity faces an existential threat, but uses that fear to justify taking control of Mars. Senior insiders knowingly enable him; the wider government and public do not know the full purpose of the expedition.",
  mystery:
    "The First Witness and the signal deepen the story beyond Dusk's human-caused war. Their exact relationship to his invasion is unknown; reveal the older history gradually through evidence and play.",
  truths: [
    {
      label: "PUBLIC ACCOUNT",
      text: "Earth receives word that Dusk and his Mars force are lost and that the Accord holds him. The public story about his mission is still to be authored.",
    },
    {
      label: "POWER NETWORKS",
      text: "A powerful inner circle knowingly enabled Dusk's private seizure attempt. Other officials, military personnel, backers, and loyalists have partial knowledge and competing motives.",
    },
    {
      label: "THE UNKNOWN",
      text: "The Accord, Mars, the signal, and The First Witness may point beyond the war's human cause. Do not assume the invasion was a Witness mission.",
    },
  ],
} as const;

export const MARS_STORY_CAST = [
  {
    name: "Mara Venn",
    role: "USSF commander · proposed",
    story: "A duty-bound commander confronts the gap between protecting people and obeying institutions that conceal the truth.",
  },
  {
    name: "Tarek Sol",
    role: "Accord wing marshal · proposed",
    story: "A defender of Martian self-determination fears the Accord could become the empire it resists.",
  },
  {
    name: "Nadiya Sen",
    role: "Signal researcher · proposed",
    story: "A scientist traces the signal as a distributed pattern whose fragments connect seemingly unrelated places.",
  },
  {
    name: "WARDEN-0",
    role: "Legacy command intelligence · proposed",
    story: "A military system obeys a continuity order older than the USSF–Accord war.",
  },
] as const;

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
    purpose: "Investigate the blackout and recover the prewar order naming the Cage and its cargo.",
    connection: "The record points to a later transfer carrying Dusk, who was captured after his fleet was destroyed.",
  },
  {
    id: "cage",
    routeId: "dust-lane",
    title: "Cage · The Disputed Transfer",
    role: "campaign-beat",
    sequenceLabel: "CHAPTER V · CUSTODY TRANSFER",
    campaignSortieId: "cage",
    purpose: "Resolve the later transfer of Dusk, already captured by the Accord, through the existing faction-specific fight.",
    connection: "The player's verified result records a local custody branch; a secured recorder reveals a signal beneath Mars.",
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
