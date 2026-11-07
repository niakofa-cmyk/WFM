import type { MissionId } from "./rewards";

export type NarrativeKnowledgeLayer = "public" | "restricted" | "classified" | "unresolved";
export type NarrativeFaction = "ussf" | "accord";
export type NarrativeOutcome = "win" | "loss" | "draw";

export type CampaignNarrativeRecord = {
  id: string;
  chapter: string;
  missionId: Extract<MissionId, "contact" | "beacon" | "warden" | "cage">;
  title: string;
  source: string;
  knowledgeLayer: NarrativeKnowledgeLayer;
  synopsis: string;
  transcript: readonly { speaker: string; text: string }[];
};

const PREFIX = "story:v1:";
export const narrativeDiscoveryId = (id: string) => `${PREFIX}${id}`;

export const CAMPAIGN_NARRATIVE_RECORDS = [
  {
    id: "dusk-rise",
    chapter: "PRELUDE · THE MAKING OF EON DUSK",
    missionId: "contact",
    title: "The fortune behind the launch",
    source: "Rust Disc · recovered financial ledger",
    knowledgeLayer: "restricted",
    synopsis: "Scattered records tie Dusk's extraordinary fortune to scandal and show how money became leverage over Mars policy. The surviving pages do not identify every beneficiary.",
    transcript: [
      { speaker: "ADVISER · RECONSTRUCTED EXCHANGE", text: "The committee has not approved a Mars seizure." },
      { speaker: "EON DUSK · RECONSTRUCTED EXCHANGE", text: "Then stop asking the committee to imagine the emergency. Give them a deadline they cannot ignore." },
    ],
  },
  {
    id: "quiet-mandate",
    chapter: "PRELUDE · THE QUIET MANDATE",
    missionId: "contact",
    title: "The people who knew",
    source: "Rust Disc · encrypted authorization fragment",
    knowledgeLayer: "classified",
    synopsis: "A compartmented group of powerful insiders knowingly enabled Dusk's private operation. Other officials were kept outside that circle; the fragment names no complete roster.",
    transcript: [
      { speaker: "POLICY ADVISER · RECONSTRUCTED EXCHANGE", text: "The wider government has not authorized this mission." },
      { speaker: "EON DUSK · RECONSTRUCTED EXCHANGE", text: "The launch window is the authorization. You decide whether history records that you helped." },
    ],
  },
  {
    id: "unlisted-expedition",
    chapter: "PRELUDE · THE UNLISTED EXPEDITION",
    missionId: "contact",
    title: "A force assembled in secret",
    source: "Rust Disc · expedition flight recorder",
    knowledgeLayer: "restricted",
    synopsis: "The recorder describes Dusk's privately assembled militia and special-force fleet, built with USSF resources and private technology networks, and a launch whose true purpose was hidden from the public and wider government.",
    transcript: [
      { speaker: "FLIGHT CONTROL · RECONSTRUCTED RECORDING", text: "Transponder profile is masked. Confirm the filed survey route." },
      { speaker: "EXPEDITION COMMAND · RECONSTRUCTED RECORDING", text: "Confirmed. Mars is the objective. Keep the seizure plan on the private channel." },
    ],
  },
  {
    id: "mars-is-not-empty",
    chapter: "PRELUDE · MARS IS NOT EMPTY",
    missionId: "contact",
    title: "The Accord's warning",
    source: "Rust Disc · recovered contact recording",
    knowledgeLayer: "public",
    synopsis: "The Accord was an established civilization defending its home, not an unknown force claiming an empty planet. Dusk's expedition rejected its warning and continued the attempted seizure.",
    transcript: [
      { speaker: "ACCORD PATROL · RECOVERED TRANSMISSION", text: "Unregistered fleet, you have entered defended Martian territory. Cut drive and identify your authority." },
      { speaker: "EXPEDITION COMMAND · RECOVERED TRANSMISSION", text: "We claim emergency jurisdiction. Stand aside." },
      { speaker: "ACCORD PATROL · RECOVERED TRANSMISSION", text: "There is no empty world here for you to claim." },
    ],
  },
  {
    id: "last-fleet-transmission",
    chapter: "PRELUDE · THE LAST FLEET",
    missionId: "contact",
    title: "The capture report",
    source: "Rust Disc · emergency beacon buffer",
    knowledgeLayer: "public",
    synopsis: "The Accord destroyed Dusk's expedition. Dusk was its only known survivor and was captured. Before the fleet was lost, an emergency transmission reached Earth with the capture report.",
    transcript: [
      { speaker: "EXPEDITION PILOT · EMERGENCY TRANSMISSION", text: "Fleet is down. Dusk is alive and in Accord custody. This is the capture report—send it to Earth now." },
      { speaker: "EARTH RELAY · RECEIPT", text: "Capture report received. Source signal fading." },
    ],
  },
  {
    id: "pale-beacon-record",
    chapter: "PRELUDE · THE PALE BEACON CONSPIRACY",
    missionId: "beacon",
    title: "A signal received in silence",
    source: "Pale Beacons · receiver history",
    knowledgeLayer: "restricted",
    synopsis: "The beacons received the same signal for years. Their receivers were deliberately kept dark so neither fleet would hear it; the suppressing actor and authority chain remain unknown.",
    transcript: [
      { speaker: "BEACON TECH · RECOVERED LOG", text: "The receiver has been logging the same pattern for years. It was never allowed to answer." },
      { speaker: "FIELD ANALYST · RECOVERED LOG", text: "Keep the raw history. The order that muted it is missing." },
    ],
  },
  {
    id: "earth-first-response",
    chapter: "PRELUDE · EARTH'S FIRST RESPONSE",
    missionId: "beacon",
    title: "The public statement and the sealed order",
    source: "Pale Beacons · duplicated Earth relay packet",
    knowledgeLayer: "classified",
    synopsis: "Earth's response split between a public account of a lost expedition and a restricted mobilization by insiders who knew Dusk's real objective. The archive does not establish that the whole government knew or agreed.",
    transcript: [
      { speaker: "PUBLIC ADDRESS · ARCHIVED", text: "An American expedition has been lost on Mars. Its commander is reported captured. The United States is seeking verified information." },
      { speaker: "SEALED WATCH CHANNEL · ARCHIVED", text: "Preserve the private launch records. Raise readiness under the existing emergency plan. Do not circulate the seizure brief." },
    ],
  },
  {
    id: "warden-prewar-order",
    chapter: "THE FIRST MARTIAN CAMPAIGN · WARDEN",
    missionId: "warden",
    title: "An order older than the front",
    source: "Night-side · WARDEN-0 black box",
    knowledgeLayer: "classified",
    synopsis: "WARDEN-0 was ordered to erase the Cage, its cargo, and the route record before the recognized USSF–Accord front. The issuer and the order's full scope remain unknown.",
    transcript: [
      { speaker: "WARDEN-0 · BLACK BOX", text: "Current belligerent status is irrelevant. Continuity mandate remains in force. Evidence suppression authorized." },
      { speaker: "RECOVERY ANALYST · FIELD NOTE", text: "The order predates the war. Its authority chain is missing." },
    ],
  },
  {
    id: "cage-ussf-secures",
    chapter: "THE FIRST MARTIAN CAMPAIGN · CAGE",
    missionId: "cage",
    title: "USSF secures the transfer",
    source: "Dust Lane · verified Cage sortie",
    knowledgeLayer: "restricted",
    synopsis: "Dusk was already an Accord prisoner from the earlier expedition. In this later transfer encounter, the USSF wins control of the transport. Its legal authority and destination remain disputed.",
    transcript: [
      { speaker: "USSF ESCORT · OPEN CHANNEL", text: "Transport secured. Seal the manifest pending review." },
      { speaker: "ACCORD INTERCEPT · OPEN CHANNEL", text: "You have taken custody of a prisoner you did not capture. Return the vessel and its records." },
    ],
  },
  {
    id: "cage-accord-transfers",
    chapter: "THE FIRST MARTIAN CAMPAIGN · CAGE",
    missionId: "cage",
    title: "The Accord completes its transfer",
    source: "Dust Lane · verified Cage sortie",
    knowledgeLayer: "restricted",
    synopsis: "Dusk was already an Accord prisoner from the earlier expedition. The Accord wins control of the later transfer and retains custody; the USSF's claimed authority remains disputed.",
    transcript: [
      { speaker: "ACCORD ESCORT · OPEN CHANNEL", text: "Transfer complete. Dusk remains in Accord custody." },
      { speaker: "USSF ESCORT · OPEN CHANNEL", text: "We reject that custody claim. Preserve every record of this encounter." },
    ],
  },
  {
    id: "cage-contested-escape",
    chapter: "THE FIRST MARTIAN CAMPAIGN · CAGE",
    missionId: "cage",
    title: "The transport escapes contested",
    source: "Dust Lane · verified Cage sortie",
    knowledgeLayer: "unresolved",
    synopsis: "The later transport leaves Dust Lane before either side can confirm control. Dusk's earlier capture remains established; his custody after this transfer is unresolved.",
    transcript: [
      { speaker: "USSF ESCORT · OPEN CHANNEL", text: "Transport lost beyond the dust field. No confirmed custody." },
      { speaker: "ACCORD INTERCEPT · OPEN CHANNEL", text: "We have no verified destination. Do not report Dusk recovered." },
    ],
  },
  {
    id: "first-witness-trace",
    chapter: "THE FIRST WITNESS · A SIGNAL BENEATH MARS",
    missionId: "cage",
    title: "The signal repeats below Mars",
    source: "Dust Lane · secured Cage recorder",
    knowledgeLayer: "unresolved",
    synopsis: "The secured recorder contains a signal repeating from beneath Mars and predating the USSF–Accord front. It is evidence of a deeper mystery, not proof of the First Witness's origin or a cause of Dusk's invasion.",
    transcript: [
      { speaker: "RESEARCH DESK · RECORDER TRANSCRIPT", text: "This is not a distress call. The pattern repeats from beneath the surface." },
      { speaker: "FLIGHT ARCHIVE · RECORDER TRANSCRIPT", text: "Then keep the raw signal intact. We do not yet know what is listening—or what it means." },
    ],
  },
] as const satisfies readonly CampaignNarrativeRecord[];

const recordById = new Map<string, CampaignNarrativeRecord>(
  CAMPAIGN_NARRATIVE_RECORDS.map((record) => [record.id, record]),
);

export type NarrativeDiscovery = {
  id: string;
  chapter: string;
  missionId: CampaignNarrativeRecord["missionId"];
  title: string;
  source: string;
  knowledgeLayer: NarrativeKnowledgeLayer;
  synopsis: string;
  transcript: { speaker: string; text: string }[];
  discoveredAt: Date;
};

export function narrativeAwardsForClaim(
  missionId: MissionId,
  faction: NarrativeFaction,
  outcome: NarrativeOutcome,
  alreadyDiscovered: readonly string[],
): string[] {
  if (missionId === "skirmish") return [];
  if (missionId === "contact") {
    return outcome === "win"
      ? ["dusk-rise", "quiet-mandate", "unlisted-expedition", "mars-is-not-empty", "last-fleet-transmission"]
      : [];
  }
  if (missionId === "beacon") {
    return outcome === "win" ? ["pale-beacon-record", "earth-first-response"] : [];
  }
  if (missionId === "warden") return outcome === "win" ? ["warden-prewar-order"] : [];
  if (missionId !== "cage" || alreadyDiscovered.some((id) => id.startsWith(`${PREFIX}cage-`))) return [];

  const branch = outcome !== "win"
    ? "cage-contested-escape"
    : faction === "ussf"
      ? "cage-ussf-secures"
      : "cage-accord-transfers";
  return outcome === "win" ? [branch, "first-witness-trace"] : [branch];
}

export function narrativeArchiveForDiscoveries(
  discoveries: readonly { locationId: string; createdAt: Date }[],
): NarrativeDiscovery[] {
  return discoveries.flatMap(({ locationId, createdAt }) => {
    if (!locationId.startsWith(PREFIX)) return [];
    const id = locationId.slice(PREFIX.length);
    const record = recordById.get(id);
    if (!record) return [];
    return [{
      ...record,
      transcript: record.transcript.map((line) => ({ ...line })),
      discoveredAt: createdAt,
    }];
  }).sort((a, b) =>
    CAMPAIGN_NARRATIVE_RECORDS.findIndex((record) => record.id === a.id) -
    CAMPAIGN_NARRATIVE_RECORDS.findIndex((record) => record.id === b.id),
  );
}
