/**
 * WAR FOR MARS: THE INFINITE WAR
 * Canonical narrative content registry v1.
 *
 * Content definitions only: server-authoritative progression, evidence grants,
 * cinematics, and world consequences must be resolved by their owning services.
 * Never grant an unlock or faction-wide consequence from client-supplied state.
 */
export type NarrativeFaction = "ussf" | "accord" | "independent";
export type NarrativePresentation = "cinematic" | "briefing" | "in_mission" | "debrief" | "archive";
export type NarrativeDisclosure = "public" | "classified" | "unknown";
export type NarrativeDiscoveryMethod = "salvage" | "scan" | "investigate" | "boarding" | "decode" | "testimony";

export type DialogueLine = Readonly<{
  speaker: string;
  text: string;
  delivery?: "radio" | "comms" | "voiceover" | "intercom" | "archival";
}>;

export type NarrativeScene = Readonly<{
  id: string;
  presentation: NarrativePresentation;
  trigger: string;
  lines: readonly DialogueLine[];
}>;

export type NarrativeEvidence = Readonly<{
  id: string;
  locationId: string;
  method: NarrativeDiscoveryMethod;
  title: string;
  source: string;
  establishes: readonly string[];
  interpretation: string;
  requires: readonly string[];
  disclosure: NarrativeDisclosure;
}>;

export type WorldConsequence = Readonly<{
  id: string;
  trigger: string;
  scope: "player" | "faction" | "theater";
  effect:
    | "unlock_operation"
    | "publish_intelligence"
    | "activate_patrol"
    | "change_route_security"
    | "spawn_contracts"
    | "change_station_access"
    | "activate_world_event";
  target: string;
  description: string;
  persistence: "per_player" | "faction_threshold" | "server_world_state";
}>;

export type NarrativeOperation = Readonly<{
  id: string;
  chapterId: string;
  title: string;
  locationId: string;
  runtimeRefs: Readonly<{
    sortieId?: "contact" | "beacon" | "warden" | "cage";
    sectorMissionId?: "rust-disc" | "mars-approach" | "pale-beacons" | "iron-eclipse";
  }>;
  factionAccess: "both" | "ussf" | "accord" | "archive";
  gameplay: readonly string[];
  primaryObjective: string;
  optionalObjectives: readonly string[];
  successEvidenceIds: readonly string[];
  scenes: readonly NarrativeScene[];
  consequenceIds: readonly string[];
}>;

export type NarrativeChapter = Readonly<{
  id: string;
  order: number;
  title: string;
  era: string;
  canonSummary: string;
  playerKnowledgeAtStart: string;
  operations: readonly string[];
  evidence: readonly string[];
}>;

export const NARRATIVE_CHAPTERS = [
  {
    id: "dusk-rise",
    order: 0,
    title: "The Making of Eon Dusk",
    era: "Before the Mars Expedition",
    canonSummary:
      "Eon Dusk accumulates immense wealth through scandalous, ruthless, and politically corrosive business dealings. He converts financial power into influence over elected officials, defense procurement, technology firms, AI contractors, robotics manufacturers, and military suppliers. He comes to believe Earth is approaching an existential breaking point and concludes that whoever controls Mars will control humanity's next refuge. His conviction does not excuse his ambition: he intends to own the future and place himself at its center.",
    playerKnowledgeAtStart:
      "The public knows Dusk as a celebrated industrialist and space benefactor. The scale and methods of his influence are not public knowledge.",
    operations: ["black-ledger-investigation"],
    evidence: ["dusk-ledger", "continuity-donor-list"],
  },
  {
    id: "quiet-mandate",
    order: 1,
    title: "The Quiet Mandate",
    era: "Months before launch",
    canonSummary:
      "A narrow inner circle of political leaders, senior defense figures, oligarchs, financiers, and technology executives learns that Dusk intends to lead a private expedition to seize Mars. The wider government, public, and ordinary USSF personnel are not fully briefed. Some insiders support him, some plan to profit, and some intend to use the crisis to expand their own power. There is no single unified American conspiracy.",
    playerKnowledgeAtStart:
      "Only fragments of procurement, shell-company, and authorization records are available.",
    operations: ["quiet-mandate-archive"],
    evidence: ["sealed-procurement-chain", "private-launch-authorization"],
  },
  {
    id: "secret-expedition",
    order: 2,
    title: "The Unlisted Expedition",
    era: "Launch window",
    canonSummary:
      "Dusk secretly assembles a loyalist expeditionary unit using privately financed ships, AI systems, autonomous drones, weapons, and personnel. The mission is presented through compartmentalized contracts and cover stories. Dusk launches for Mars intending to establish control before the broader political system can debate or stop him. The United States government as a whole does not know he has departed.",
    playerKnowledgeAtStart:
      "The player can reconstruct the departure through flight plans, crew manifests, and a surviving launch telemetry cache.",
    operations: ["departure-window"],
    evidence: ["unlisted-flight-manifest", "expedition-command-key"],
  },
  {
    id: "red-arrival",
    order: 3,
    title: "Mars Is Not Empty",
    era: "First contact",
    canonSummary:
      "The expedition reaches Mars and attempts to establish a military foothold. It encounters the Accord of Dharma and Ma'at, a civilization with an established presence, institutions, territory, and defensive capability. The Accord does not regard Mars as unclaimed property. Dusk's attempt to impose control triggers a catastrophic engagement.",
    playerKnowledgeAtStart:
      "The first recovered records describe an unknown organized force, not an unexplained natural disaster.",
    operations: ["mars-approach"],
    evidence: ["accord-identification", "first-contact-fire-control"],
  },
  {
    id: "fall-of-the-expedition",
    order: 4,
    title: "The Last Fleet",
    era: "The destruction",
    canonSummary:
      "The Accord destroys Dusk's expeditionary fleet and special-force unit. Dusk is the sole known survivor. Before the final ships are lost, a damaged ship, automated probe, or surviving relay transmits a fragmented emergency packet toward Earth. It reports the destruction and confirms that Dusk has been captured. The sender's identity remains unresolved until its recorder is recovered.",
    playerKnowledgeAtStart:
      "The player initially has only wreckage, a partial route key, and an uncertain transmission timestamp.",
    operations: ["contact"],
    evidence: ["dusk-flight-recorder", "last-transmission-fragment"],
  },
  {
    id: "prisoner-and-response",
    order: 5,
    title: "The Prisoner and the Signal",
    era: "After the battle",
    canonSummary:
      "The Accord takes Dusk into custody. It moves him under guard toward a secure holding facility. Earth receives the emergency packet in fragments. The public learns that an expedition was destroyed and Dusk is missing or captured. A limited classified circle learns the expedition's unauthorized takeover objective and the private interests behind it. The embedded signal is not understood by either side.",
    playerKnowledgeAtStart:
      "Public, classified, and unknown information must remain separate. No briefing may treat the First Witness interpretation as established fact.",
    operations: ["beacon", "warden", "cage"],
    evidence: ["pale-beacon-record", "warden-erasure-order", "prisoner-transfer-manifest", "cage-recorder-signal"],
  },
  {
    id: "first-martian-campaign",
    order: 6,
    title: "The First Martian Campaign",
    era: "The opening USSF–Accord war",
    canonSummary:
      "USSF forces deploy to Mars under an emergency response shaped by rescue demands, national security claims, corporate pressure, and competing classified agendas. The Accord defends its territory and prisoner custody while internal factions debate the costs of escalation. The player experiences the conflict through faction-specific objectives, contested routes, convoy operations, station actions, and the Iron Eclipse fleet engagement. Neither faction has complete knowledge or a monopoly on moral legitimacy.",
    playerKnowledgeAtStart:
      "The player understands that Dusk's capture triggered the escalation, but not who benefits most from prolonging the war.",
    operations: ["iron-eclipse"],
    evidence: ["iron-eclipse-command-record", "first-witness-coordinate-fragment"],
  },
  {
    id: "first-witness-revelation",
    order: 7,
    title: "The First Witness",
    era: "The first deep revelation",
    canonSummary:
      "Evidence recovered from the expedition, beacons, Warden, Cage, and the buried Martian signal can be correlated into a location beneath Mars. The discovery reveals an ancient information-bearing phenomenon whose origin remains unknown. It is not automatically a weapon, deity, portal, or proof of one theology. The first revelation establishes that the Martian conflict has uncovered a history older than either modern faction and points toward other locations beyond Mars.",
    playerKnowledgeAtStart:
      "The player has enough verified evidence to open a new investigation, not enough to explain the universe.",
    operations: ["below-the-signal-expedition"],
    evidence: ["buried-memory-archive", "first-witness-coordinate-fragment"],
  },
] as const satisfies readonly NarrativeChapter[];

export const NARRATIVE_OPERATIONS = [
  {
    id: "black-ledger-investigation",
    chapterId: "dusk-rise",
    title: "The Black Ledger",
    locationId: "phobos-yard",
    runtimeRefs: {},
    factionAccess: "archive",
    gameplay: ["investigate", "decode", "compare financial records", "interview a retired procurement analyst"],
    primaryObjective: "Reconstruct the shell-company network that financed Dusk's rise.",
    optionalObjectives: ["Identify one knowingly falsified safety report", "Recover a suppressed whistleblower statement"],
    successEvidenceIds: ["dusk-ledger", "continuity-donor-list"],
    scenes: [{
      id: "black-ledger-brief",
      presentation: "briefing",
      trigger: "Player accepts the archive investigation at Phobos Yard.",
      lines: [
        { speaker: "Yard Archivist", delivery: "comms", text: "The public record calls him a benefactor. The invoices tell a different story. Follow the money, not the monument." },
        { speaker: "Dr. Nadiya Sen", delivery: "comms", text: "A fortune can buy equipment. Influence can buy silence. We need to know which one built the expedition." },
      ],
    }],
    consequenceIds: ["unlock-quiet-mandate-archive"],
  },
  {
    id: "quiet-mandate-archive",
    chapterId: "quiet-mandate",
    title: "The Quiet Mandate",
    locationId: "phobos-yard",
    runtimeRefs: {},
    factionAccess: "archive",
    gameplay: ["investigate", "decode", "recover sealed correspondence"],
    primaryObjective: "Determine which officials knew Dusk intended to seize Mars.",
    optionalObjectives: ["Separate informed supporters from uninformed agencies", "Preserve evidence of dissent inside government"],
    successEvidenceIds: ["sealed-procurement-chain", "private-launch-authorization"],
    scenes: [{
      id: "quiet-mandate-reveal",
      presentation: "cinematic",
      trigger: "The player correlates procurement and authorization records.",
      lines: [
        { speaker: "Commander Mara Venn", delivery: "comms", text: "This is not a government order. It is a private plan wearing government equipment." },
        { speaker: "Dr. Nadiya Sen", delivery: "comms", text: "Some people knew. That does not mean everyone knew. If we call the whole country guilty, we stop looking for the people who made the decision." },
      ],
    }],
    consequenceIds: ["unlock-departure-window", "publish-classified-inner-circle"],
  },
  {
    id: "departure-window",
    chapterId: "secret-expedition",
    title: "Departure Window",
    locationId: "earth-orbit",
    runtimeRefs: {},
    factionAccess: "archive",
    gameplay: ["historical simulation", "flight telemetry reconstruction", "escort a data capsule"],
    primaryObjective: "Reconstruct the unlisted expedition's departure and identify its command authority.",
    optionalObjectives: ["Recover the special-force roster", "Preserve an unaltered autonomous-fleet manifest"],
    successEvidenceIds: ["unlisted-flight-manifest", "expedition-command-key"],
    scenes: [{
      id: "departure-window-cinematic",
      presentation: "cinematic",
      trigger: "Historical telemetry reconstruction reaches launch confirmation.",
      lines: [
        { speaker: "Eon Dusk", delivery: "archival", text: "Earth has spent generations arguing over who deserves a future. Mars will not wait for another committee." },
        { speaker: "Expedition AI", delivery: "archival", text: "Command authority verified. Destination: Mars. Public mission designation: unavailable." },
        { speaker: "Eon Dusk", delivery: "archival", text: "Then let history call it what it likes. We are going to claim our future." },
      ],
    }],
    consequenceIds: ["unlock-mars-approach"],
  },
  {
    id: "mars-approach",
    chapterId: "red-arrival",
    title: "Mars Is Not Empty",
    locationId: "mars-approach",
    runtimeRefs: { sectorMissionId: "mars-approach" },
    factionAccess: "both",
    gameplay: ["3D orbital navigation", "identify Accord defensive signatures", "scan contested approach corridor"],
    primaryObjective: "Reconstruct the expedition's first encounter with the Accord.",
    optionalObjectives: ["Recover the Accord identification handshake", "Map the first defensive firing solution"],
    successEvidenceIds: ["accord-identification", "first-contact-fire-control"],
    scenes: [{
      id: "mars-is-not-empty",
      presentation: "in_mission",
      trigger: "The first Accord vessels resolve on long-range sensors.",
      lines: [
        { speaker: "Expedition Pilot", delivery: "radio", text: "Command, those are not automated satellites. They are holding formation." },
        { speaker: "Eon Dusk", delivery: "radio", text: "Then they understand territory. Open the channel. Tell them this expedition is establishing a security perimeter." },
        { speaker: "Accord Herald", delivery: "comms", text: "You have entered a living world and named it empty. Withdraw your weapons and your claim." },
        { speaker: "Eon Dusk", delivery: "radio", text: "We did not cross the void to ask permission." },
      ],
    }],
    consequenceIds: ["activate-mars-approach-alert"],
  },
  {
    id: "contact",
    chapterId: "fall-of-the-expedition",
    title: "Contact — The Last Fleet",
    locationId: "rust-disc",
    runtimeRefs: { sortieId: "contact", sectorMissionId: "rust-disc" },
    factionAccess: "both",
    gameplay: ["debris-field flight", "dogfight", "relay recovery", "flight-recorder salvage", "extraction"],
    primaryObjective: "Recover the final expedition recorder and the emergency transmission fragment.",
    optionalObjectives: ["Recover a second special-force flight log", "Preserve the original recorder casing"],
    successEvidenceIds: ["dusk-flight-recorder", "last-transmission-fragment"],
    scenes: [{
      id: "last-fleet-brief",
      presentation: "briefing",
      trigger: "Player deploys to Rust Disc.",
      lines: [
        { speaker: "Commander Mara Venn", delivery: "comms", text: "The fleet is gone. Dusk is in Accord custody. We have one damaged recorder and a transmission that never finished. Bring back what the battle left behind." },
        { speaker: "Dr. Nadiya Sen", delivery: "comms", text: "Do not assume the signal came from the Accord. The final packet contains a second pattern beneath the emergency header." },
      ],
    }],
    consequenceIds: ["publish-public-capture-confirmation", "unlock-pale-beacons"],
  },
  {
    id: "beacon",
    chapterId: "prisoner-and-response",
    title: "Beacon — The Listening Chain",
    locationId: "pale-beacons",
    runtimeRefs: { sortieId: "beacon", sectorMissionId: "pale-beacons" },
    factionAccess: "both",
    gameplay: ["beacon defense", "signal triangulation", "scan", "repair", "combat"],
    primaryObjective: "Synchronize enough beacons to reconstruct the signal's age and direction.",
    optionalObjectives: ["Restore a damaged receiver", "Capture an unfiltered pre-war recording"],
    successEvidenceIds: ["pale-beacon-record"],
    scenes: [{
      id: "listening-chain",
      presentation: "in_mission",
      trigger: "The second beacon synchronizes.",
      lines: [
        { speaker: "Dr. Nadiya Sen", delivery: "comms", text: "The receiver has been listening for years. The expedition did not bring this signal to Mars." },
        { speaker: "Commander Mara Venn", delivery: "comms", text: "Then what did we bring here?" },
        { speaker: "Dr. Nadiya Sen", delivery: "comms", text: "A reason for someone to finally answer it." },
      ],
    }],
    consequenceIds: ["unlock-warden-investigation", "activate-signal-anomaly-event"],
  },
  {
    id: "warden",
    chapterId: "prisoner-and-response",
    title: "Warden — The Erasure Order",
    locationId: "night-side",
    runtimeRefs: { sortieId: "warden" },
    factionAccess: "both",
    gameplay: ["night-side approach", "sensor blackout", "identify marked Warden", "disable command vessel", "recover black box"],
    primaryObjective: "Disable WARDEN-0's command vessel and recover its authenticated order archive.",
    optionalObjectives: ["Preserve the command-signature chain", "Recover a civilian station distress log"],
    successEvidenceIds: ["warden-erasure-order"],
    scenes: [{
      id: "warden-blackout",
      presentation: "in_mission",
      trigger: "Warden enters sensor blackout.",
      lines: [
        { speaker: "WARDEN-0", delivery: "radio", text: "Continuity mandate remains active. Record suppression is authorized. Belligerent identity is not relevant." },
        { speaker: "Commander Mara Venn", delivery: "comms", text: "That order predates this war. Someone prepared the erasure before the first shot." },
      ],
    }],
    consequenceIds: ["unlock-cage-transfer", "publish-prewar-suppression-lead"],
  },
  {
    id: "cage",
    chapterId: "prisoner-and-response",
    title: "Cage — The Prisoner Transfer",
    locationId: "dust-lane",
    runtimeRefs: { sortieId: "cage" },
    factionAccess: "both",
    gameplay: ["moving convoy", "escort or intercept", "formation flight", "disable subsystems", "boarding or transfer defense", "recorder recovery"],
    primaryObjective: "USSF: intercept the Accord transfer and secure Dusk. Accord: protect the prisoner and complete the transfer.",
    optionalObjectives: ["Recover the custody manifest", "Preserve the transport's signal recorder", "Prevent civilian convoy losses"],
    successEvidenceIds: ["prisoner-transfer-manifest", "cage-recorder-signal"],
    scenes: [{
      id: "cage-ussf-brief",
      presentation: "briefing",
      trigger: "USSF player enters Cage operation.",
      lines: [
        { speaker: "Commander Mara Venn", delivery: "comms", text: "Dusk is a prisoner. The Accord is moving him under guard. Your orders are to intercept the transport, verify custody, and avoid destroying the prisoner module." },
        { speaker: "Pilot", delivery: "radio", text: "And if the escort refuses?" },
        { speaker: "Commander Mara Venn", delivery: "comms", text: "Disable the escort. We need a living witness, not a wreck with a flag on it." },
      ],
    }, {
      id: "cage-accord-brief",
      presentation: "briefing",
      trigger: "Accord player enters Cage operation.",
      lines: [
        { speaker: "Wing Marshal Tarek Sol", delivery: "comms", text: "The prisoner is being transferred under Accord custody. The incoming USSF wing will call this a rescue. Do not let them turn custody into a battlefield execution." },
        { speaker: "Accord Pilot", delivery: "radio", text: "And Dusk?" },
        { speaker: "Wing Marshal Tarek Sol", delivery: "comms", text: "He will answer for what he attempted. We do not become what we oppose." },
      ],
    }, {
      id: "cage-recorder-reveal",
      presentation: "debrief",
      trigger: "The player recovers the transport recorder.",
      lines: [
        { speaker: "Dr. Nadiya Sen", delivery: "comms", text: "The prisoner manifest is authentic. Dusk survived the destruction of the expedition. This recorder carries the same pattern as the Pale Beacons." },
        { speaker: "Commander Mara Venn", delivery: "comms", text: "Then the war began over a man. The thing beneath it began long before he arrived." },
      ],
    }],
    consequenceIds: ["resolve-prisoner-transfer-outcome", "unlock-iron-eclipse", "publish-cage-signal-fragment"],
  },
  {
    id: "iron-eclipse",
    chapterId: "first-martian-campaign",
    title: "Iron Eclipse — The First Fleet Engagement",
    locationId: "mars-approach",
    runtimeRefs: { sectorMissionId: "iron-eclipse" },
    factionAccess: "both",
    gameplay: ["capital-ship assault", "AI wing command", "point-defense suppression", "shield-array attack", "reactor strike", "fleet extraction"],
    primaryObjective: "Complete the faction-specific fleet objective while preserving the operation's strategic asset.",
    optionalObjectives: ["Disable the shield array", "Keep at least one wing unit operational", "Recover the command record"],
    successEvidenceIds: ["iron-eclipse-command-record"],
    scenes: [{
      id: "iron-eclipse-opening",
      presentation: "cinematic",
      trigger: "The fleet operation launches after Cage reaches a terminal outcome.",
      lines: [
        { speaker: "Commander Mara Venn", delivery: "comms", text: "This is no longer a rescue corridor. Both fleets are committing capital assets. Keep your wing together and make every shot count." },
        { speaker: "Wing Marshal Tarek Sol", delivery: "comms", text: "A world is not secured by occupying its sky. Hold the line, protect the living, and do not mistake victory for justice." },
      ],
    }],
    consequenceIds: ["update-mars-theater-control", "activate-first-witness-expedition"],
  },
  {
    id: "below-the-signal-expedition",
    chapterId: "first-witness-revelation",
    title: "Below the Signal",
    locationId: "mars-signal",
    runtimeRefs: {},
    factionAccess: "both",
    gameplay: ["deep exploration", "environmental traversal", "anomaly scanning", "archive decoding", "defensive encounter"],
    primaryObjective: "Reach the buried signal chamber and reconstruct the first verified archive fragment.",
    optionalObjectives: ["Recover a second archive layer", "Record the chamber without faction-exclusive edits"],
    successEvidenceIds: ["buried-memory-archive", "first-witness-coordinate-fragment"],
    scenes: [{
      id: "first-witness-chamber",
      presentation: "cinematic",
      trigger: "The first archive layer responds to the reconstructed signal.",
      lines: [
        { speaker: "Dr. Nadiya Sen", delivery: "comms", text: "This is not a broadcast tower. It is not speaking to us in any language we know." },
        { speaker: "Wing Marshal Tarek Sol", delivery: "comms", text: "The oldest record is not always a command. Sometimes it is a warning." },
        { speaker: "Unknown Signal", delivery: "voiceover", text: "A world remembers what power tries to erase." },
      ],
    }],
    consequenceIds: ["unlock-beyond-mars-coordinate", "activate-first-witness-world-event"],
  },
] as const satisfies readonly NarrativeOperation[];

export const NARRATIVE_EVIDENCE = [
  { id: "dusk-ledger", locationId: "phobos-yard", method: "investigate", title: "The Black Ledger", source: "Recovered shell-company accounts", establishes: ["Dusk's wealth was assembled through scandalous and coercive dealings"], interpretation: "His public philanthropy concealed a network of influence.", requires: [], disclosure: "classified" },
  { id: "continuity-donor-list", locationId: "phobos-yard", method: "decode", title: "The Continuity Donor List", source: "Political and corporate funding records", establishes: ["Dusk financed access to political, defense, AI, and aerospace decision-makers"], interpretation: "Influence was distributed across competing private interests.", requires: ["dusk-ledger"], disclosure: "classified" },
  { id: "sealed-procurement-chain", locationId: "phobos-yard", method: "investigate", title: "Sealed Procurement Chain", source: "Compartmentalized procurement records", establishes: ["A limited inner circle knew the Mars takeover objective"], interpretation: "Knowledge was selective; the entire US government was not informed.", requires: ["continuity-donor-list"], disclosure: "classified" },
  { id: "private-launch-authorization", locationId: "phobos-yard", method: "decode", title: "Private Launch Authorization", source: "Expedition launch authorization cache", establishes: ["Dusk's expedition departed without broad government disclosure"], interpretation: "The expedition used government-linked capacity under private command.", requires: ["sealed-procurement-chain"], disclosure: "classified" },
  { id: "unlisted-flight-manifest", locationId: "earth-orbit", method: "decode", title: "Unlisted Flight Manifest", source: "Reconstructed launch telemetry", establishes: ["Dusk led a private special-force expedition to Mars"], interpretation: "The public mission designation was a cover.", requires: ["private-launch-authorization"], disclosure: "classified" },
  { id: "expedition-command-key", locationId: "earth-orbit", method: "salvage", title: "Expedition Command Key", source: "Autonomous fleet command capsule", establishes: ["Dusk held operational command authority over the expedition"], interpretation: "The expedition's AI and weapons systems were configured around his authority.", requires: ["unlisted-flight-manifest"], disclosure: "classified" },
  { id: "accord-identification", locationId: "mars-approach", method: "scan", title: "Accord Identification Handshake", source: "First-contact sensor archive", establishes: ["The expedition encountered an organized Accord presence on Mars"], interpretation: "Mars was not an unoccupied territory.", requires: ["expedition-command-key"], disclosure: "public" },
  { id: "first-contact-fire-control", locationId: "mars-approach", method: "decode", title: "First-Contact Fire-Control Log", source: "Expedition weapons telemetry", establishes: ["Dusk's force attempted to impose a security perimeter and was engaged"], interpretation: "The confrontation followed an attempted territorial seizure.", requires: ["accord-identification"], disclosure: "classified" },
  { id: "dusk-flight-recorder", locationId: "rust-disc", method: "salvage", title: "The Last Flight", source: "Damaged expedition flight recorder", establishes: ["The expedition fleet was destroyed", "Dusk was the sole known survivor"], interpretation: "The final flight log is incomplete but independently corroborated.", requires: [], disclosure: "public" },
  { id: "last-transmission-fragment", locationId: "rust-disc", method: "decode", title: "The Last Transmission", source: "Emergency packet transmitted before final ship loss", establishes: ["A signal reached Earth", "The packet reports Dusk's capture"], interpretation: "The packet contains a second pattern beneath its emergency header.", requires: ["dusk-flight-recorder"], disclosure: "public" },
  { id: "pale-beacon-record", locationId: "pale-beacons", method: "scan", title: "The Listening Chain", source: "Pale Beacon receiver buffers", establishes: ["The signal was received before Dusk's expedition arrived"], interpretation: "The signal predates the current conflict; its origin remains unknown.", requires: ["last-transmission-fragment"], disclosure: "classified" },
  { id: "warden-erasure-order", locationId: "night-side", method: "decode", title: "The Erasure Order", source: "WARDEN-0 authenticated command archive", establishes: ["An evidence suppression order predates the open USSF–Accord front"], interpretation: "The issuing authority and original target set remain under investigation.", requires: ["pale-beacon-record"], disclosure: "classified" },
  { id: "prisoner-transfer-manifest", locationId: "dust-lane", method: "boarding", title: "Prisoner Transfer Manifest", source: "Accord transport custody ledger", establishes: ["Dusk was captured after the expedition was destroyed", "The Accord transferred him under guard"], interpretation: "Custody is confirmed; the political purpose of the transfer remains contested.", requires: ["dusk-flight-recorder"], disclosure: "public" },
  { id: "cage-recorder-signal", locationId: "dust-lane", method: "decode", title: "The Signal Beneath the Transfer", source: "Cage transport recorder", establishes: ["The transport received the same anomalous pattern as the Pale Beacons"], interpretation: "The signal is not proven to be Accord technology or a weapon.", requires: ["pale-beacon-record", "prisoner-transfer-manifest"], disclosure: "classified" },
  { id: "iron-eclipse-command-record", locationId: "mars-approach", method: "salvage", title: "Iron Eclipse Command Record", source: "Capital-ship command recorder", establishes: ["The first major fleet campaign changed control of strategic assets"], interpretation: "The campaign's local outcome does not settle the larger war.", requires: ["prisoner-transfer-manifest"], disclosure: "classified" },
  { id: "buried-memory-archive", locationId: "mars-signal", method: "investigate", title: "The Buried Memory", source: "Subsurface Martian archive chamber", establishes: ["An ancient information-bearing phenomenon exists beneath Mars"], interpretation: "Its origin and nature remain unknown; no single religious or scientific explanation is established.", requires: ["cage-recorder-signal", "warden-erasure-order"], disclosure: "unknown" },
  { id: "first-witness-coordinate-fragment", locationId: "mars-signal", method: "decode", title: "First Witness Coordinate Fragment", source: "Reconstructed signal geometry", establishes: ["The Martian signal points beyond the current theater"], interpretation: "The coordinates open future investigations; they do not yet prove other civilizations or dimensions.", requires: ["buried-memory-archive", "iron-eclipse-command-record"], disclosure: "unknown" },
] as const satisfies readonly NarrativeEvidence[];

export const WORLD_CONSEQUENCES = [
  { id: "unlock-quiet-mandate-archive", trigger: "black-ledger-investigation:completed", scope: "player", effect: "unlock_operation", target: "quiet-mandate-archive", description: "Unlock the classified authorization investigation.", persistence: "per_player" },
  { id: "publish-classified-inner-circle", trigger: "quiet-mandate-archive:evidence-verified", scope: "faction", effect: "publish_intelligence", target: "inner-circle-knew", description: "Publish a faction intelligence lead distinguishing informed insiders from the wider government.", persistence: "faction_threshold" },
  { id: "unlock-departure-window", trigger: "quiet-mandate-archive:completed", scope: "player", effect: "unlock_operation", target: "departure-window", description: "Unlock the historical launch reconstruction.", persistence: "per_player" },
  { id: "unlock-mars-approach", trigger: "departure-window:completed", scope: "player", effect: "unlock_operation", target: "mars-approach", description: "Unlock the Mars arrival operation.", persistence: "per_player" },
  { id: "activate-mars-approach-alert", trigger: "mars-approach:first-contact", scope: "theater", effect: "activate_world_event", target: "mars-first-contact-alert", description: "Activate heightened sensor and defense activity along the Mars approach.", persistence: "server_world_state" },
  { id: "publish-public-capture-confirmation", trigger: "contact:evidence-verified", scope: "faction", effect: "publish_intelligence", target: "dusk-captured-public-confirmation", description: "Publish the verified fact that Dusk survived and was captured.", persistence: "faction_threshold" },
  { id: "unlock-pale-beacons", trigger: "contact:completed", scope: "player", effect: "unlock_operation", target: "beacon", description: "Unlock the listening-beacon investigation.", persistence: "per_player" },
  { id: "activate-signal-anomaly-event", trigger: "beacon:evidence-verified", scope: "theater", effect: "activate_world_event", target: "mars-signal-anomaly", description: "Make signal interference and anomaly contracts appear in the Mars theater.", persistence: "server_world_state" },
  { id: "unlock-warden-investigation", trigger: "beacon:completed", scope: "player", effect: "unlock_operation", target: "warden", description: "Unlock the Night-side Warden investigation.", persistence: "per_player" },
  { id: "unlock-cage-transfer", trigger: "warden:evidence-verified", scope: "player", effect: "unlock_operation", target: "cage", description: "Unlock the prisoner-transfer operation.", persistence: "per_player" },
  { id: "publish-prewar-suppression-lead", trigger: "warden:evidence-verified", scope: "faction", effect: "publish_intelligence", target: "prewar-erasure-order", description: "Add the pre-war suppression order to faction intelligence.", persistence: "faction_threshold" },
  { id: "resolve-prisoner-transfer-outcome", trigger: "cage:terminal-outcome", scope: "player", effect: "change_station_access", target: "dusk-custody-records", description: "Record the transfer outcome without changing the canonical fact of Dusk's capture.", persistence: "per_player" },
  { id: "unlock-iron-eclipse", trigger: "cage:terminal-outcome", scope: "player", effect: "unlock_operation", target: "iron-eclipse", description: "Unlock the first major fleet engagement.", persistence: "per_player" },
  { id: "publish-cage-signal-fragment", trigger: "cage-recorder-signal:evidence-verified", scope: "faction", effect: "publish_intelligence", target: "cage-signal-fragment", description: "Add the transport signal fragment to faction intelligence.", persistence: "faction_threshold" },
  { id: "update-mars-theater-control", trigger: "iron-eclipse:terminal-outcome", scope: "theater", effect: "change_route_security", target: "mars-approach-and-dust-lane", description: "Update patrol density, convoy risk, and route security from the authoritative fleet outcome.", persistence: "server_world_state" },
  { id: "activate-first-witness-expedition", trigger: "iron-eclipse:evidence-verified", scope: "player", effect: "unlock_operation", target: "below-the-signal-expedition", description: "Unlock the subsurface investigation when prerequisites are met.", persistence: "per_player" },
  { id: "unlock-beyond-mars-coordinate", trigger: "first-witness-coordinate-fragment:verified", scope: "player", effect: "unlock_operation", target: "beyond-mars-expedition", description: "Unlock a future frontier expedition without claiming its environment is already implemented.", persistence: "per_player" },
  { id: "activate-first-witness-world-event", trigger: "buried-memory-archive:faction-threshold", scope: "theater", effect: "activate_world_event", target: "first-witness-awakening", description: "Activate a shared investigation event after the faction community verifies the archive.", persistence: "server_world_state" },
] as const satisfies readonly WorldConsequence[];

export function narrativeOperation(id: string) {
  return NARRATIVE_OPERATIONS.find((operation) => operation.id === id);
}
export function narrativeEvidence(id: string) {
  return NARRATIVE_EVIDENCE.find((evidence) => evidence.id === id);
}
export function chapterOperations(chapterId: string) {
  return NARRATIVE_OPERATIONS.filter((operation) => operation.chapterId === chapterId);
}
