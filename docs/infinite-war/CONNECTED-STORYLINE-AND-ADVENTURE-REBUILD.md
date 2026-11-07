# WAR FOR MARS: INFINITE WAR — connected storyline and adventure rebuild

## Purpose and precedence

This document makes the narrative requirement explicit: the game is not a
collection of disconnected missions that happen to share an engine. The story
must give players reasons to travel, investigate, fight, escort, defend, form
alliances, and affect a larger conflict across Mars and eventually the wider
universe.

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

The following is the proposed connected geography based on the existing
campaign and owner-supplied redesign sources. It preserves established story
anchors while marking travel bridges and future reveals as design work.

| Story/world beat | Location or route | Narrative and player purpose | Current interpretation |
|---|---|---|---|
| Contact | Rust Disc | Recover the relay route key; establish that the signal is more than an ordinary distress call. | Existing campaign beat and separate compatibility expedition; not one continuous route. |
| Mars arrival corridor | Mars Approach | Travel into the Mars theater, encounter traffic or defenses when implemented, and choose onward destinations. | Existing separate sector operation; route bridge, not an extra campaign prerequisite by assumption. |
| Beacon | Pale Beacons | Triangulate the muted relay chain and discover that someone has been suppressing the receivers. | Existing campaign beat and separate compatibility expedition. |
| Warden | Night-side Station / dark hemisphere | Cross into the night-side blackout, discover the blockade's purpose, and recover its record. | Existing campaign story identity; the physical rotating night-side world is planned. |
| Cage | Dust Lane | Encounter the moving transport and make a faction- and operation-specific choice around Eon Dusk and the signal. | Existing campaign identity; a persistent moving convoy and branching operation are not yet established. |
| Below the Signal | Subsurface mystery | Follow the signal beneath Mars and connect the Mars conflict to later universe discoveries. | Existing recovered-intelligence reveal; playable surface/subsurface environments remain planned. |
| Iron Eclipse | Contested Mars orbit | Participate in a consequential fleet engagement connected to the wider war. | Existing separate operation; its canonical chronology and relationship to the signal require owner-story continuity review. |

The supplied seven-chapter outline (Silent Frontier, Mars Arrival, Pale Beacon
Conspiracy, Night-Side Blockade, Eon Dusk Extraction, Iron Eclipse, Beyond the
Signal) is a useful **proposed structure**, not yet locked canon. In particular,
the current authored campaign has four sorties and does not include Mars
Approach as a campaign sortie; the co-op route has a different three-operation
chain; Iron Eclipse's placement remains unresolved. A story bible must reconcile
these before chapter numbers, unlock rules, or new canon are asserted.

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

1. **Story/source audit:** compare all owner sources, current campaign and
   recovered intel, sector mission definitions, briefings, dispatches,
   encounter content, and existing persistence. Record canon, proposals, and
   unresolved contradictions.
2. **Canonical story bible:** agree on chronology, faction motives, signal
   history, Warden/Eon Dusk/Cage relationships, and Iron Eclipse's position.
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

The new `mars-story-thread.ts` data and atlas section connect existing story
identities to the existing route catalog for **navigation context only**. The
atlas continues to derive each location's implementation status from
`mars-adventure-network.ts`. The story thread has no launch action, account
write, operation authority, live-event claim, or reward capability. This is
intentional groundwork, not the shared server operation contract or the
NIGHTFALL acceptance slice.
