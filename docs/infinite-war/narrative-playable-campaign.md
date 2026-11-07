# Infinite War — Playable campaign and world consequence plan

**Status:** Content-to-runtime implementation contract for review.  
**Runtime:** Orbital Combat Engine only. React is presentation/UI, not a second simulation runtime.  
**Authority:** The server owns mission eligibility, evidence validation, branch outcomes, rewards, and persistent consequences.

## Campaign design principle

The story is embedded in the open universe through three synchronized layers:

1. Canonical narrative: immutable historical facts, character knowledge, chronology, and unresolved mysteries.
2. Playable operation: a location, encounter, objective, dialogue trigger, cinematic, evidence source, and debrief.
3. Persistent world state: validated player discoveries, faction intelligence, route security, patrols, contracts, and world events.

The narrative registry is implemented as content definitions in artifacts/api-server/src/game/narrative-campaign.ts. It is not yet a live progression service. Do not expose its content as proof that an operation, cinematic, or database consequence is already playable.

## Chapter-to-operation matrix

| Chapter | Player-facing experience | Existing runtime reference | Required new gameplay/content | Persistent result |
|---|---|---|---|---|
| The Making of Eon Dusk | Phobos Yard archive investigation; reconstruct the Black Ledger | Existing Phobos Yard world location and world services | Evidence terminal, record comparison, testimony, archive UI | Personal evidence; unlock Quiet Mandate |
| The Quiet Mandate | Investigate sealed procurement and private authorization | Phobos Yard archive activity | Branching document analysis; distinguish informed insiders from uninformed institutions | Classified intelligence lead; unlock Departure Window |
| The Unlisted Expedition | Reconstruct the launch using telemetry and an archival flight simulation | No current operation reference | Clearly labeled historical simulation; manifest recovery; telemetry route reconstruction | Expedition manifest and command key; unlock Mars Approach |
| Mars Is Not Empty | Fly the Mars approach and identify Accord forces | Existing mars-approach sector mission | Contact cinematic, sensor identification, territorial warning, first-contact evidence | Mars alert; new patrol and diplomatic encounter activity |
| The Last Fleet | Fight through Rust Disc debris and recover the expedition recorder and emergency packet | Existing Contact sortie and rust-disc sector mission | Recorder salvage interaction; transmission decode; distinguish emergency packet from relay signal | Public capture confirmation; unlock Pale Beacons |
| The Prisoner and Earth's Response | Investigate Pale Beacons, Warden, and Cage transfer | Existing Beacon, Warden, and Cage sorties; Pale Beacons sector mission | Three-layer Earth intelligence briefing; Warden authenticated archive; faction-specific Cage objectives | Evidence archive; faction intelligence; Cage custody outcome; unlock Iron Eclipse |
| The First Martian Campaign | Fight the first major capital-ship engagement | Existing Iron Eclipse sector mission | Connect to campaign chronology; faction briefing, capital objective, post-battle route state | Theater control, route security, patrols, convoy contracts |
| The First Witness | Explore the buried signal and reconstruct an archive fragment | Existing world location mars-signal is a map/quest entry only | Subsurface environment, Orbital-native traversal, scan/decoding, cinematic and evidence chain | First Witness discovery; shared event threshold; future coordinates |

## Operation design contracts

### 1. The Black Ledger — Phobos Yard

**Purpose:** Establish Dusk's rise through evidence, not a villain monologue.

Gameplay loop:
- Accept an investigation contract at the Phobos Yard dispatch terminal.
- Visit a records broker, damaged data terminal, and retired procurement analyst.
- Compare shell-company payments with public space-program announcements.
- Recover the Black Ledger and donor network.
- Optional: preserve a whistleblower statement and identify one falsified safety report.

Cinematic: use a short archival montage of Dusk at hearings, corporate launches, private negotiations, and a Mars presentation. The montage must not assert that every politician or USSF member was involved.

Persistent consequence: unlock Quiet Mandate. Evidence remains personal until submitted to a faction intelligence terminal.

### 2. The Quiet Mandate — Phobos Yard archive

**Purpose:** Reveal selective knowledge inside the political and corporate elite.

Gameplay loop:
- Decode sealed procurement records.
- Match authorization signatures to the private expedition command chain.
- Identify three categories: knowingly enabled, suspected but uninformed, and actively dissenting.
- Preserve dissent records as an optional objective.

Cinematic: Mara Venn recognizes that a private plan used government-linked systems. Nadiya Sen cautions against blaming the entire government.

Persistent consequence: classified faction lead and Departure Window unlock. Do not apply a blanket hostility modifier to every USSF NPC.

### 3. Departure Window — historical reconstruction

**Purpose:** Let players experience Dusk's launch without pretending it is a current live event.

Gameplay loop:
- Launch a replay reconstructed from telemetry, not a time-travel event.
- Escort a data capsule through a simulated traffic corridor.
- Recover the manifest and command key.
- Optional: recover the AI fleet's original rules-of-engagement file.

Cinematic: Dusk's launch speech contrasts his public survival rhetoric with his private claim of Mars. The archival UI must label date, source, and reconstruction confidence.

Persistent consequence: unlock Mars Approach and add Dusk's expedition roster to the evidence archive.

### 4. Mars Is Not Empty — Mars Approach

**Purpose:** Show the Accord as an established civilization with agency and territory.

Gameplay loop:
- Enter the approach corridor.
- Scan structured formations and identify Accord command signatures.
- Avoid or survive defensive fire.
- Recover the first-contact fire-control record.

Cinematic: Dusk demands a security perimeter; an Accord herald orders withdrawal. This is the point where the player understands the expedition attempted a seizure.

Persistent consequence: activate a Mars approach alert and change encounter tables to include Accord patrols. No new renderer or disconnected map is introduced.

### 5. Contact — The Last Fleet / Rust Disc

**Purpose:** Make the destroyed expedition and the transmission tangible.

Gameplay loop:
- Navigate wreckage and hostile patrols.
- Disable the relay guardian / defending wing as the current mission requires.
- Locate the recorder using its beacon signature.
- Salvage the flight recorder and emergency packet.
- Extract before the debris field destabilizes.

Cinematic: recovered cockpit audio establishes the fleet's destruction and Dusk's capture. The exact transmitting vessel remains uncertain until its recorder is decoded.

Persistent consequence: publish the verified public fact that Dusk survived and was captured; unlock the Pale Beacon investigation.

### 6. Beacon — The Listening Chain

**Purpose:** Prove that the signal predates the expedition.

Gameplay loop:
- Secure and synchronize at least two beacons.
- Scan their receiver buffers.
- Restore a damaged pre-war recording.
- Optional: capture an unfiltered receiver sample before the USSF sweep arrives.

Dialogue reveal: Nadiya states that the beacons were listening years before Dusk arrived. This disproves the simple theory that the Accord invented the signal during the battle.

Persistent consequence: activate signal-anomaly activity and unlock Warden.

### 7. Warden — The Erasure Order

**Purpose:** Discover a suppression order that predates the open war.

Gameplay loop:
- Approach Night-side Station during a sensor blackout.
- Identify the marked Warden command vessel.
- Disable the vessel using the current combat loop.
- Recover its authenticated black box.
- Optional: preserve civilian station distress logs.

Dialogue reveal: WARDEN-0 confirms that a continuity mandate authorizes record suppression. Mara recognizes that the order predates the current front.

Persistent consequence: add a pre-war suppression lead to faction intelligence; unlock Cage. The issuing authority remains unknown.

### 8. Cage — The Prisoner Transfer

**Purpose:** Resolve custody continuity and give both factions distinct playable goals.

Historical truth:
- The Accord already captured Dusk after destroying his expedition.
- Cage is a later guarded transfer to a secure holding facility.
- The transport carries custody records and a signal recorder; Dusk did not voluntarily arrange his capture.

USSF objectives:
- Intercept the transport.
- Disable escort vessels and defensive systems without destroying the prisoner module.
- Board or secure the transport.
- Recover the custody manifest and recorder.

Accord objectives:
- Protect the prisoner module.
- Repel interceptors.
- Maintain formation and complete the transfer.
- Preserve the custody record and prevent the transport from being destroyed.

Branching terminal states:
- USSF secures transport: custody changes to USSF-controlled custody pending a later story decision; the canonical capture history remains unchanged.
- Accord completes transfer: Accord custody continues; the transport recorder can still be recovered from an escort or later investigation.
- Contested escape: transport escapes damaged or is disabled without a secure boarding result; both factions retain partial records and the next operation changes its access route.

Persistent consequence: record custody state, evidence ownership, route security, and faction intelligence. Do not set Dusk free or kill him as a generic match result. A major canonical custody change requires a deliberate campaign chapter and authored scenes.

### 9. Iron Eclipse — first major fleet campaign

**Purpose:** Escalate from fighter operations to a combined fleet battle.

Gameplay loop:
- Deploy with a three-ship wing.
- Issue tactical commands using the existing Iron Eclipse order system.
- Suppress point defense, attack the shield array, and strike the reactor according to faction objective.
- Extract with surviving wing units and command data.

Cinematic: Mara and Tarek each frame the battle through their own duty and fears. Neither should be written as omniscient.

Persistent consequence: update local theater control, patrol density, convoy risk, station access, and contracts based on verified server-side outcomes. The result does not conclude the war.

### 10. Below the Signal — first Witness expedition

**Purpose:** Deliver the first major revelation while preserving mystery.

Gameplay loop:
- Follow a reconstructed coordinate route from Dust Lane.
- Enter a subsurface environment only after that environment exists in Orbital.
- Traverse environmental hazards and scan the chamber.
- Decode a fragment without assuming a human-readable language.
- Optional: record the chamber without faction-exclusive edits.

Cinematic: Nadiya refuses to call the phenomenon a weapon, portal, or deity. Tarek warns that an old record is not necessarily a command.

Persistent consequence: add the verified archive fragment to the player's evidence archive. A faction threshold may activate a shared investigation event. A coordinate unlocks a future expedition; it does not imply that the next planet or dimension is already built.

## Dialogue and cinematic production rules

- Each scene has a stable scene ID, trigger, speaker, delivery channel, and localized text key.
- Dialogue triggers are tied to authoritative mission events, not arbitrary client timers.
- Cinematics can be skippable; skipped scenes must not skip evidence validation or campaign state.
- Radio chatter must not obscure flight-critical audio cues.
- Dialogue variants may reflect faction, operation outcome, or evidence already held.
- Keep a transcript in the evidence archive for accessibility and replay.
- Historical reconstructions must be visually labeled as archival simulations.
- Do not use a cinematic as the only source of a critical unlock; evidence must be recoverable through a verifiable gameplay interaction.

## Persistent state and world effects

Player scope:
- Operation attempts and outcomes.
- Verified evidence IDs and provenance.
- Dialogue scenes seen.
- Branch decisions.
- Personal custody and intelligence records.

Faction scope:
- Submitted and verified intelligence.
- Community evidence thresholds.
- Shared operation unlocks.
- Faction contracts and strategic priorities.

Theater scope:
- Route security and patrol density.
- Convoy availability and risk.
- Station access and services.
- World event activation and duration.
- Strategic control derived from authoritative outcomes.

A personal discovery is not automatically a universe-wide fact. The server validates evidence submission and applies faction or theater changes only after explicit thresholds and idempotent transactions.

## Technical integration boundaries

- Keep Orbital Combat Engine as the exclusive game runtime for flight, world coordinates, scanning, salvage, boarding spaces, combat, environment, and streaming.
- React owns briefing screens, evidence archive, maps, dialogue captions, and menu presentation.
- The API server owns narrative eligibility, evidence verification, operation settlement, faction intelligence, and consequences.
- PostgreSQL stores durable state and event history.
- Existing world APIs and progression services should be extended rather than bypassed.
- Do not trust client-supplied evidence IDs, faction totals, mission completion, custody state, or world state.
- Do not duplicate mission definitions between client and server. Establish a shared, versioned contract or server-owned catalog with typed client responses.
- Existing numeric cleared progression may remain as a compatibility projection while explicit operation state is migrated and verified.

## Acceptance gates

1. A player cannot unlock a chapter by sending a fabricated evidence ID.
2. Repeated interaction requests do not duplicate evidence, credits, or consequences.
3. Evidence requires a valid operation, location, interaction method, and prerequisites.
4. Cage's three outcomes preserve the same historical capture facts.
5. USSF and Accord receive faction-appropriate objectives and dialogue.
6. Historical scenes are clearly labeled reconstructions.
7. Public, classified, and unknown information are not conflated.
8. Skipping cinematics does not bypass server validation.
9. Personal evidence and faction-wide intelligence remain separate.
10. Shared world events are activated once, transactionally, and are visible consistently to connected players.
11. World consequences change actual authoritative route, patrol, service, or contract state—not just a text label.
12. No production deployment or live database migration occurs until staging tests and owner approval.
13. The Orbital-only engine boundary is preserved; Three.js must not become a second renderer/runtime.

## Implementation status

The content registry is a first code artifact. Existing Rust Disc, Mars Approach, Pale Beacons, Iron Eclipse, Contact, Beacon, Warden, Cage, Phobos Yard, Night-side, Dust Lane, and Mars Signal references have been mapped. Historical archive operations, evidence persistence, cinematic playback, subsurface gameplay, and dynamic faction/theater consequences still require runtime and database implementation. This plan must not be reported as fully playable until each acceptance gate is demonstrated.
