# WAR FOR MARS: INFINITE WAR — connected storyline and adventure rebuild

## Purpose and precedence

This document makes the narrative requirement explicit: the game is not a
collection of disconnected missions that happen to share an engine. The story
must give players reasons to travel, investigate, fight, escort, defend, form
alliances, and affect a larger conflict across Mars and eventually the wider
universe.

The owner-directed foundational premise is maintained in
[WAR FOR MARS Storyline Foundation](WAR-FOR-MARS-STORYLINE-FOUNDATION.md), with
the full source preserved in
[`references/redesign/`](references/redesign/Pasted-Absolutely-This-is-the-original-premise-we-should-build_1794063278746.txt).
Eon Dusk's attempt to claim Mars and the First Witness mystery provide the
human catalyst and deeper cosmological thread. Apply that premise without
overwriting established operation identities or disguising proposed lore as
implemented canon.

The [Orbital Universe Rebuild Contract](ORBITAL-UNIVERSE-REBUILD-CONTRACT.md)
remains authoritative for the engine, boot, simulation, migration, and
authority boundaries. This document governs how story, geography, routes,
operations, and world consequences relate inside that runtime. It does not
authorize replacing established story, changing server contracts, awarding
local results, or claiming planned regions are playable.

The five new owner sources are preserved byte-for-byte in
[`references/`](references/):

- [Complete Orbital-exclusive rebuild source](references/COMPLETE-ORBITAL-ENGINE-EXCLUSIVE-REBUILD-SOURCE.txt)
- [Master storyline, navigation, command and sortie source](references/MASTER-STORYLINE-UNIVERSE-NAVIGATION-COMMAND-SORTIE-SOURCE.txt)
- [Mars routes and command redesign recommendation](references/MARS-ROUTES-COMMAND-SORTIE-RECOMMENDATION-SOURCE.txt)
- [Repository implementation blueprint](references/REPOSITORY-IMPLEMENTATION-BLUEPRINT-SOURCE.txt)
- [Unified story and operations implementation directive](references/UNIFIED-STORY-MARS-OPERATIONS-IMPLEMENTATION-DIRECTIVE-SOURCE.txt)

These sources agree that Orbital is the intended main game runtime, that the
universe must connect story and play, and that the API remains authoritative
for multiplayer, progression, and persistent consequences. Proposed content
and acceptance targets below are not evidence that the corresponding feature
already exists.

## The central design rule

**The storyline is a thread through a living world, not a mission-selection
menu.**

- Locations are places in the universe.
- Routes are optional travel guidance between places, not mission rails.
- Story beats explain why the conflict and discoveries matter.
- Operations are activities that happen in those places.
- Dynamic events can be discovered without accepting a campaign operation.
- Commands coordinate a player's wing or assigned units; they do not silently
  take control of another human pilot.
- The same world, location, operation, faction, and entity identities must be
  used by navigation, operations, strategic views, and server contracts.

Campaign progression should offer a coherent path without preventing players
from exploring, joining eligible multiplayer activities, or returning to the
story later. Optional investigation and repeatable world activity are part of
the universe, not filler missions between chapters.

## Current repository baseline — separate paths, not yet one story graph

The current code contains strong narrative anchors, but they are not yet one
shared route-and-operation graph:

1. `campaign.ts` defines the authored Contact → Beacon → Warden → Cage sequence
   and recovered-intelligence records. Preserve those stable sortie IDs and
   story facts while the continuity audit is completed.
2. `sector-missions.ts` separately defines Rust Disc → Mars Approach → Pale
   Beacons, plus Iron Eclipse with no prerequisite.
3. `sector-navigation.ts` selects the next incomplete Rust Disc / Mars
   Approach / Pale Beacons operation from recorded flight discoveries. This is
   not the campaign sequence and does not currently insert the Warden or Cage.
4. `mars-adventure-network.ts` supplies an informational route atlas with
   explicit local, compatibility, and planned states. It is not an operation
   directory or a live event feed.
5. Existing account, co-op, Wing, reward, and operation services own their
   respective authority. A local exploration result cannot grant a kill,
   unlock, reward, faction standing, or persistent world change.

The intended relationship is therefore a **design graph**, not a claim that
the existing paths have already been consolidated. Do not silently merge
campaign prerequisites with co-op sector prerequisites or remap IDs. The shared
contract and migration must resolve those relationships explicitly.

## Narrative geography and connective thread

The [Mars Story Chronology and Canon](MARS-STORY-CHRONOLOGY-AND-CANON.md)
records the source-backed resolution in detail. The main story-facing order is:

**Contact → Mars arrival corridor → Beacon → Warden → Cage → Iron Eclipse → Beyond the Signal**

This is an authored narrative sequence layered over the universe, not a new
mission-lock chain. Chapter labels do not change the current four-sortie
campaign gates or the separate cooperative discoveries.

The foundation adds the prehistory: scandal-enriched billionaire Eon Dusk
manipulates a powerful inner circle, uses a private force with USSF support to
attempt a Mars seizure, and is captured after the Accord destroys his fleet. A
transmission to Earth reports his capture before the fleet is destroyed and
triggers the crisis that becomes the USSF–Accord war. Dusk is not a serving
military commander or a willing truth-teller. The exact later custody transfer
and Cage transport context remain open continuity questions. See the story
foundation and chronology rather than inventing an explanation in route UI.

| Story order | Location or route | Narrative purpose | Current implementation boundary |
|---|---|---|---|
| Prelude | Signal history predates the USSF–Accord front; the beacons received it for years; the Warden erasure order also predates that front. | Established by recovered campaign intel. The signal's source and the actors behind the blackout/order remain unknown. |
| I · Contact | Rust Disc | Recover the relay route key and establish that the signal is more than a distress call. | Existing campaign `contact`; the co-op Rust Disc operation shares place/theme, not the same operation result. |
| II · Arrival | Mars Approach corridor | Move into the Mars theater and choose onward destinations. | Geographic travel interlude only. The existing co-op Mars Approach survey is separate and does not unlock the campaign's Beacon sortie. |
| III · Beacon | Pale Beacons | Trace the signal and discover that someone kept the receivers dark. | Existing campaign `beacon`; the co-op `pale-beacons` scout operation and its server discovery remain separate. The suppressing actor is unknown. |
| IV · Warden | Night-side Station / dark hemisphere | Investigate the blackout and recover the Warden's record. | Existing campaign `warden`. A full rotating night-side world is planned; the order's issuer is unknown. |
| V · Cage | Dust Lane | Confront the transport carrying Eon Dusk and expose the deeper signal. | Existing campaign `cage`. The brief says USSF escorts it and the Accord must stop it; the exact custody-transfer history is unresolved. |
| VI · proposed · Iron Eclipse | Contested Mars orbit | Make the exposed signal consequential to the wider fleet conflict. | The latest owner outline places this operation after Cage. Its strategic trigger and aftermath remain proposed; the existing operation remains independent and no campaign gate is added. |
| VII · future · Beyond the Signal | Subsurface mystery | Follow the recovered signal beneath Mars and into later discoveries. | A future narrative lead, not a playable operation or built subsurface region. |

**Iron Eclipse is positioned as the proposed Chapter VI fleet operation** per
the latest owner chapter outline. This gives the working story map a continuous
place for the existing operation, while keeping the exact cause, command
authority, and consequences visibly proposed. It remains separately enterable
under its current operation contract and is not made a campaign prerequisite.

The seven-part outline is therefore reconciled as five existing campaign beats,
one optional geographic interlude, a proposed fleet-operation placement, and a
future signal arc—not seven mandatory campaign sorties.

## Make exploration part of the war

Exploration should create context and opportunities, rather than merely
discovering the next mission marker:

- A relay, wreck, signal, station, convoy, or anomaly has a physical location
  and a discoverable state.
- Faction actors have objectives and can investigate, shadow, challenge, warn,
  intercept, disengage, or request reinforcements based on their actual
  territory, sensors, distance, speed, transponder, weapons, target state, and
  current operation.
- The encounter can branch into combat, negotiation/identification, rescue,
  escort, evasion, investigation, or withdrawal when those behaviors are
  supported by the authoritative simulation.
- The player's actions can change a validated operation outcome. Only
  server-validated results may persist campaign progress, kill attribution,
  rewards, faction standing, or world consequences.
- A player not following the authored campaign can still encounter supported
  patrols, distress calls, competitive installations, co-op operations, and
  discoveries through the same universe.
- Public activity visibility is derived from server-owned public state.
  Private rooms, hidden positions, synthetic participants, and local previews
  are never presented as public live events.

“Live,” “persistent,” “multiplayer,” “rewardable,” and “in-world” each require
their own implementation evidence. A map marker, generated local scenery,
training drone, cached location, or client-reported kill is not that evidence.

## Unified story, route, operation, and world-state model

The migration target is one versioned, shared contract used by the Orbital
runtime, client presentation, and authoritative services. Keep it modular:

- **Story graph:** stable chapter/beat identity, chronology status, narrative
  prerequisites, optional branches, evidence/intel links, and the next
  narrative reveal.
- **Location:** stable world identity, parent body/system/region, coordinate
  frame, implemented capability flags, ownership/visibility, and available
  services.
- **Route:** version, origin/destination, advisory corridors/waypoints,
  hazards, faction presence, discovery opportunities, event pools, and
  streaming/authority boundaries.
- **Operation definition:** story references, type, eligible factions, phases,
  objectives, branch conditions, roles, extraction/failure rules, and
  consequence policy.
- **Operation instance:** server-owned participants, state, phase/tick,
  objective progress, event references, reconnect/recovery data, and result
  settlement identity.
- **World event/encounter:** authoritative identity/version, location and
  bounds, lifecycle, visibility policy, actor goals, and allowed entry modes.
- **Command:** issuer/authority, assigned unit or target, order, priority,
  expiry, validation, and resulting authoritative behavior.
- **Outcome:** validated objectives, kills/assists, discoveries, extraction,
  and idempotent server settlement. The client may display a report but cannot
  author the outcome.

Definitions and data must not depend on renderer scene objects. The renderer
reads world state; it does not create story canon, operation authority, or
rewards. Preserve specialized simulation behavior through versioned adapters
until a replacement passes parity and rollback checks.

## First complete connected operation

The owner sources recommend **Operation NIGHTFALL — The Mars Night-side
Corridor** as the first full journey proof. It should connect—not replace—the
existing Contact/Beacon/Warden/Cage story:

1. Receive an order with a real issuing authority and assigned role.
2. Launch into the Orbital runtime and travel through actual Mars geography.
3. Cross the day/night boundary without a reset of player or world state.
4. Discover a distress signal and a damaged relay/station through an
   authoritative event.
5. Make a meaningful operational choice and coordinate a wing; commands cause
   validated unit behavior.
6. Recover the recorder or complete a supported alternative objective.
7. Extract and receive a debrief based on authoritative results.
8. Revisit the location and observe only the validated persistent consequence.
9. Reconnect or retry without duplicate settlement or story advancement.

This is a future acceptance target, not an implemented feature. Build it in
small slices: first resolve contracts and chronology, then prove a bounded
operation lifecycle, then expand world travel and multiplayer behavior. Do not
fake the day/night crossing, wing response, persistent consequence, or two-human
authority to make a demo appear complete.

## Implementation order and acceptance gates

1. **Story/source audit:** the working Mars chronology now reconciles the
   authored campaign facts, current co-op route, and owner-proposed chapter
   outline. A full universe-history and faction-motive bible remains outstanding.
2. **Canonical story bible:** retain the working order in
   [Mars Story Chronology and Canon](MARS-STORY-CHRONOLOGY-AND-CANON.md) and
   keep proposed Iron Eclipse causality separate from established facts. Do
   not fabricate the signal source, Warden's issuer, or Dusk's custody transfer.
3. **Shared identities and contracts:** map stable route, POI, story, operation,
   objective, actor, event, and result IDs; remove client/server catalog
   duplication only with protocol and replay compatibility tests.
4. **Navigation integration:** show the story thread in the same universe map
   as routes and current capability state. Routes remain advisory; selecting a
   story hint must not bypass server unlocks or create a local authority claim.
5. **Operation lifecycle:** build one bounded versioned adapter with briefing,
   travel, encounter, branching objective, extraction, debrief, interruption,
   reconnect, and idempotent settlement tests.
6. **World travel and multiplayer:** add continuous Mars navigation, shared
   authoritative presence/events, and physical-device verification in separate
   gates.
7. **Expansion:** extend to other Mars regions and the wider universe only after
   the first connected journey passes its gates.

Acceptance requires:

- Existing story identities and established facts remain intact; proposals are
  labeled and unresolved continuity is explicit.
- Campaign, co-op, and standalone operation IDs/prerequisites are not
  accidentally conflated.
- A route is not presented as a mission, and a mission does not masquerade as a
  physical destination.
- A player can explore outside the main story and return without losing
  narrative continuity.
- Any live encounter, command, kill tally, result, reward, and persistent
  consequence is derived from the appropriate authoritative service.
- Maps and HUDs accurately distinguish local, compatibility, planned,
  inaccessible, active, and completed states.
- Automated tests, builds, staging evidence, device evidence, and rollback are
  reported separately; a design document or passing unit test is not release
  certification.

## Current implementation slice

The `mars-story-thread.ts` data and atlas section present Contact → Mars
Approach interlude → Beacon → Warden → Cage → proposed Iron Eclipse → future
Beyond the Signal and now show the foundational premise with its three layers
of truth. The atlas derives implementation status from
`mars-adventure-network.ts`; this thread is **navigation context only**. It has
no launch action, account write, operation authority, live-event claim, or
reward capability. It adds no progression gate and does not change the separate
sector operation prerequisites. This is intentional groundwork, not the shared
server operation contract or the NIGHTFALL acceptance slice.
