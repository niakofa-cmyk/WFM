# WAR FOR MARS: INFINITE WAR — Mars story chronology and canon

## Status and scope

This is the working chronology and playable-story map for the Mars campaign.
It separates owner-directed canon, server-verified story discoveries, authored
dialogue reconstructions, proposed connective material, and still-unknown lore.
The opening campaign is playable; future geography and the wider universe remain
distinct from what the current code has verified.

The existing authored campaign text and recovered-intelligence records establish
the strongest canon available in the repository. Owner-supplied chapter
outlines guide how that canon should connect, but their proposed additions do
not override existing facts or create new campaign unlocks. See the
[connected storyline rebuild](CONNECTED-STORYLINE-AND-ADVENTURE-REBUILD.md),
the [foundational storyline direction](WAR-FOR-MARS-STORYLINE-FOUNDATION.md),
and the preserved [master storyline source](references/MASTER-STORYLINE-UNIVERSE-NAVIGATION-COMMAND-SORTIE-SOURCE.txt).

## Resolved main-story chronology

The chronological story is:

**Dusk's rise → the quiet mandate → the unlisted expedition → the Accord defense → the fleet's destruction and Dusk's capture → Earth's response → the first USSF–Accord campaign → the Cage transfer → the First Witness evidence**

Players encounter this history through the existing Contact, Beacon, Warden,
and Cage campaign operations. The dated events happen before or during those
operations; they are not additional campaign sorties.

| Order | Story beat | Established facts | Status and boundary |
|---|---|---|---|
| Prelude 1 | **The Making of Eon Dusk** | A scandal-enriched billionaire builds power by manipulating political fear about humanity's survival and Mars. | Owner-directed canon. His rise and private political dealings are revealed through recovered records; the complete insider roster is unknown. |
| Prelude 2 | **The Quiet Mandate** | Dusk's powerful inner circle knowingly enables a private operation while the wider government and public remain unaware of its actual purpose. | Owner-directed canon. Dialogue in the archive is labeled reconstructed unless independently established as a recording. |
| Prelude 3 | **The Unlisted Expedition** | Dusk assembles a private militia and special-force fleet with USSF and technology-network support, then secretly launches toward Mars. | Owner-directed canon. Do not describe Dusk as a serving USSF commander or imply a public mandate. |
| Prelude 4 | **Mars Is Not Empty** | The Accord is an established civilization defending its home. Dusk's expedition attempts to seize Mars and is met by Accord resistance. | Owner-directed canon. The Accord is not a newly discovered hostile species or an unclaimed planet. |
| Prelude 5 | **The Last Fleet** | The Accord destroys Dusk's expedition. Dusk is its only known survivor and is captured. A transmission reporting his capture reaches Earth before the fleet is destroyed. | Owner-directed canon. Dusk does not surrender to expose the signal and did not choose the later Cage transfer route. |
| Prelude 6 | **Earth's First Response** | Earth receives the capture report. Senior insiders know the concealed purpose of the expedition; the public and wider government do not have the full account. The crisis escalates into the first USSF–Accord campaign. | The transmission and crisis sequence are canon; exact public statements, command decisions, and named officials are authored connective material. |
| I | **Contact — Rust Disc** | The existing campaign sortie breaks the defending wing and preserves a relay. A verified victory unlocks the first recovered records of Dusk's rise, the mandate, the expedition, the Accord's warning, and the capture report. | Existing campaign ID `contact`. The co-op Rust Disc operation shares the location and theme but remains a separate server operation and result. |
| Travel bridge | **Mars Approach — the arrival corridor** | The route key gives the player a reason to travel into the Mars theater. | Geographic transition only, not a campaign sortie or mandatory campaign unlock. The co-op Mars Approach survey remains separate and does not imply surface landing. |
| III | **Pale Beacon Conspiracy — Beacon** | The campaign secures two of three beacons. A verified victory reveals that the chain received the signal for years and that someone kept its receivers dark, plus Earth's public statement and sealed response. | Existing campaign ID `beacon`. The co-op `pale-beacons` operation is distinct. The person or faction that muted the receivers remains unknown. |
| IV | **Night-Side Blockade — Warden** | The campaign targets a marked Warden. Its verified victory reveals an order to erase the Cage, cargo, and route record. | Existing campaign ID `warden`. The order predates the front; its author and authority are unknown. |
| V | **Cage — the later transfer** | Dusk was already captured during the destroyed expedition. Cage is a later transfer through Dust Lane; the USSF escorts while Accord forces intercept. | Existing campaign ID `cage`. The verified result records one player-specific branch: USSF secures the transport; Accord completes the transfer; or the transport escapes contested. The operation does not explain the disputed custody authority or destination. |
| V · evidence | **The First Witness — a signal beneath Mars** | A secured Cage recorder contains a signal repeating from beneath the Martian surface, older than the current front. | Revealed only when Cage is won and its recorder is secured. This is evidence of a mystery, not proof of the Witness's origin or a cause of Dusk's invasion. |
| VI · proposed | **Iron Eclipse — Fleet Offensive** | Make the newly public Mars mystery matter to the wider USSF–Accord conflict through a consequential fleet operation. | The owner chapter outline places Iron Eclipse after Cage. This is a proposed story position, not current canon in code or a campaign gate. The operation remains separately enterable with no sector prerequisite. Its strategic trigger and persistent consequence still need to be authored. |
| VII · future | **Beyond the Signal — Below Mars** | Continue the investigation of the signal repeating from beneath the Martian surface. | A future narrative destination and revelation. Subsurface exploration and a playable continuation are not established. |

The sequence preserves the existing campaign sortie IDs and clear-count gates:
Contact, Beacon, Warden, then Cage. Mars Approach is a travel interlude, not a
new campaign sortie. The narrative archive does not alter reward amounts,
clear-count gates, co-op prerequisites, or combat result authority.

## Separate co-op progression and shared place names

The existing cooperative exploration chain remains:

**Rust Disc → Mars Approach → Pale Beacons**

It is advanced by server-recorded `flight:` discoveries. Those discoveries do
not clear the original campaign sorties. Rust Disc and Pale Beacons can share
locations, evidence themes, and story context with Contact and Beacon without
being the same operation instance, result, or unlock. Their relationship is
cross-reference by place and narrative subject—not a merged progression chain.

The atlas may show both paths in one universe, but every operation identity and
result must continue to come from its existing authority until a separately
approved shared contract migrates it.

## Iron Eclipse: proposed Chapter VI, independent operation access

The latest owner-proposed seven-chapter outline places Iron Eclipse after the
Cage reveal and before Beyond the Signal. This chronology is adopted as the
working story-map sequence. A connective premise is proposed: once the Cage
makes the signal public, the conflict escalates into a fleet-level struggle
over the Mars orbital theater and access to the exposed evidence. That motive
is a design proposal, not a fact in the current campaign or Iron Eclipse
operation text; refine it before presenting it as established lore.

The story-map placement does not change the current operation contract:

- Keep its current separate operation identity and no-prerequisite access.
- Mark its Chapter VI position as proposed in narrative UI and documentation.
- Do not make it a campaign clear-count gate or change its result authority.
- Design its issuing authority, strategic objective, faction perspective, and
  consequences before claiming that the proposed motive is canon.

## Playable evidence and persistent state

The campaign path still awards story evidence while settling a completed,
verified campaign claim. In addition, Orbital V2 Pale Beacons flight now lets
pilots physically recover two records: the Pale Beacon receiver history and the
Earth relay packet. The server chooses the record from the authenticated
pilot's position, range, and line of sight; the client cannot submit an
evidence ID or position. Recovery writes the same stable ID to the existing
world-discovery ledger and an idempotent zero-credit `world_exploration` event.
Repeated pickup or a prior campaign discovery cannot duplicate the archive
record. Cage's first verified result is retained as that player's branch; a
later replay does not rewrite the historical record.

The authenticated world response returns only records that this player has
recovered. It includes a synopsis, source, knowledge classification, dialogue
transcript, and discovery timestamp. The in-game archive presents those records
as reconstructed/recovered story scenes and opens after a verified sortie
settles. This is account-specific persistence. It does **not** yet synchronize
faction-wide knowledge or alter global NPC behavior, the shared live universe,
or other players' records.

The dialogue is authored narrative, not a claim that the lines are verbatim
recordings. The UI labels speakers and sources so reconstructed dialogue is not
misrepresented as authenticated evidence.

## Canon rules for future writing

1. Preserve the owner-directed foundational premise: Dusk is a scandal-enriched
   billionaire and political manipulator who uses fear for humanity's survival
   to justify a private attempt to seize Mars, enabled by powerful insiders.
   The Accord destroys his expedition and captures him as its only known
    survivor; a transmission reports his capture to Earth before the fleet is
    destroyed and precipitates the conflict. Dusk is not a serving military
    commander, willing truth-teller, or voluntary Cage-route witness. Preserve
    the recovered facts: the signal predates the front; the beacons received it
    for years; the Warden's erasure order predates the front; the signal repeats
    from below Mars. Do not assume the Mars seizure was originally motivated by
    the Witness.
2. Do not claim who originated the signal, suppressed the beacons, or issued the
   Warden order. Do not state an unverified custody authority or destination for
   the later Cage transfer.
3. The USSF escort and Accord interception are established mission setup. Let
   verified battle outcomes determine the player's transfer branch; do not
   imply one player's result changes the faction-wide or global universe state.
4. Preserve the campaign and co-op chains as separate authoritative progression
   systems. Shared geography is not shared completion.
5. Treat the Chapter VI Iron Eclipse placement as an owner-directed proposal,
   distinct from implemented chronology and unlock behavior.
6. Allow players to explore, answer supported events, and return to the story;
   travel advice must not become an artificial mission rail.
7. Mark unbuilt geography, including the full rotating night-side world,
   subterranean region, and future universe, as planned rather than live.

## Implementation record

The server-side narrative registry maps Contact, Beacon, Warden, and Cage
settlements to authenticated evidence and dialogue. The existing player
discoveries and progression-event tables store the resulting records without a
schema migration. The authenticated `GET /world` contract returns only the
signed-in player's recovered narrative records. The campaign debrief reads that
server response rather than deriving classified records from local clear counts.

The campaign brief and dispatch text now reflect the earlier Accord capture and
later, contested Cage transfer. The prior line claiming Dusk chose the Cage
route to expose the signal has been removed. The co-op chain, Iron Eclipse
entry/access, and all battle/reward semantics remain separate.

Implemented in-world recovery is currently limited to two optional records in
Pale Beacons. Other Contact, Beacon, Warden, and Cage records retain their
verified campaign-claim path until their routes gain their own server-placed
interactions. The recovery is per account; it does not create faction-wide
knowledge, global NPC consequences, or a physical cinematic. The archive is a
server-verified narrative scene/transcript, not a rendered video cutscene or
proof of those future systems.
