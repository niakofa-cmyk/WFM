# WAR FOR MARS: INFINITE WAR — connected-universe redesign

## Owner direction · 2026-11-06

The owner has explicitly asked to **start the redesign now**, using Orbital
Combat Lab as the evolving game foundation and the attached universe document
and five images as the redesign direction.

**One universe. Multiple game experiences. One connected war.**

The complete document is preserved unchanged at
[Multiplayer Universe Architecture — source](references/redesign/MULTIPLAYER-UNIVERSE-ARCHITECTURE-SOURCE.txt).
Its historical repository, PR, runtime-version, and deployment assertions are
source commentary, not newly verified release facts.

The subsequent [Infinite Open Universe directive](references/redesign/INFINITE-OPEN-UNIVERSE-SOURCE.txt)
is also preserved unchanged and was read in full. It controls the final runtime
target where the two sources differ: **one canonical Orbital gameplay engine**.
It adds the detailed faction ecosystems, encounter lifecycle, meaningful
anomaly mechanics, streaming, activity gateway and A–J acceptance programme.

Five additional engine/asteroid/OON documents are now preserved and reconciled
in the [master directive review](MASTER-DIRECTIVE-RECONCILIATION.md). They
reinforce Orbital as the primary foundation, operation adapters for preserved
specialist experiences, and true server-backed battle visibility. The later
multiplayer-architecture upload repeats the already archived source verbatim;
neither copy certifies live spectator gameplay.

This direction permits a bounded visual redesign now; the earlier
engine-consolidation-before-appearance deferral does not prohibit this work.
It does not certify that engine consolidation has finished.

## Product identity

Advanced pilot controls are part of this universe redesign, not a separate
engine or decorative interface. The [tactical-control review](ADVANCED-TACTICAL-CONTROLS-REVIEW.md)
indexes both newly supplied copies of the advanced directive, the preserved
working control mappings, the safety implementation and A–K status/gaps.

The universe is the player's primary context. Stations, asteroid arenas,
cooperative operations, campaigns, specialist flight experiences and anomalies
belong to locations in that universe rather than disconnected applications.
Orbital is the final canonical spatial-flight/combat/runtime owner. Preserve
specialist experiences as distinct mode configurations and operation adapters.
Existing runtimes remain available as migration/rollback paths until parity,
authority and acceptance gates pass; they are not a permanent competing engine
architecture. Preserve distinctive mechanics rather than flattening every mode
into one generic arena.

The intended experience is:

**Universe entry → ship preparation → destination discovery → approach →
operation admission → gameplay → validated debrief → return to the universe.**

The universe is not the authority for every combat instance. Authentication,
eligibility, rooms, teams, damage, rewards and persistent outcomes retain their
existing server owners. Navigation presentation cannot grant a seat or reward.

## Visual direction and saved references

These are user-supplied **design references**, not original WFM art or proof of
implemented gameplay. Retain their attribution/provenance as supplied; do not
publish third-party game screenshots as WFM gameplay or assume redistribution
rights. Build original environments informed by their spatial qualities.

| Saved reference | Direction to extract |
|---|---|
| [Galaxy navigation](references/redesign/galaxy-navigation.jpeg) | Readable orbital geography, connected stations, distinct destination markers and route hierarchy |
| [Rift and fleet scale](references/redesign/rift-and-fleet-scale.jpeg) | Monumental structures, luminous spatial phenomena, fleet scale and depth |
| [Orbital ring station](references/redesign/orbital-ring-station.jpeg) | A station that reads as an inhabited physical destination, docking scale, rings and lighting |
| [Asteroid docking](references/redesign/asteroid-docking.jpeg) | Stacked approaches, functional station structures, a legible flight corridor |
| [Industrial orbit](references/redesign/industrial-orbit.jpeg) | Habitat scale, modular industry, asteroid-field composition and readable ship silhouettes |

Use a consistent WFM identity across navigation and operations. Keep USSF and
Accord distinguishable. The center of active flight remains uncluttered, with
the established two-thumb landscape control arrangement preserved. Portrait
command screens must remain scrollable and keyboard/touch accessible.

## Current source-backed foundation

Reviewed the saved master direction, structural roadmap, Orbital direction,
asteroid-hub documentation and actual entry/navigation/approach components.
Before this redesign slice:

- `src/combat-lab.tsx` launched the existing no-reward local Arena, with faction,
  hull selection, fixed training seed and return-to-entry result handling.
- `game/CinderRingDockingApproach.tsx` provided a local shared-Orbital flight
  approach with bounded docking checks. It did not authorize a multiplayer seat.
- Main application routes retained account-backed Hangar/Universe services,
  separate local flight and authenticated co-op entry.
- Existing universe activity code consumed server operation-directory state.
  A local entry illustration is not that live directory or a spectator stream.
- Shared match-outcome rules and client/API parity checks existed, but the full
  combat orchestration was still duplicated. All-mode migration was unfinished.

The preceding regression report is at
[engine regression evidence](engine/ENGINE-REGRESSION-REPORT.md). Those counts
are evidence for that revision, not automatic certification of this redesign.

## First redesign implementation

Current delivered scope and verification are recorded separately in
[Redesign implementation evidence](REDESIGN-IMPLEMENTATION-REPORT.md).

Redesign `/combat-lab.html` in the existing artifact, not a new game foundation.

1. Replace the isolated test-menu presentation with an original navigable
   universe command interface and coherent destination selection.
2. Keep Mars Orbit training connected to the actual existing Arena, with the
   same simulation, selected faction/hull, controls, and no-reward boundary.
3. Connect Cinder Ring to the existing **local** flightable station approach.
   Completing this preview must not admit the player to a room, impersonate a
   server travel result or award progression.
4. Give the existing account-backed universe a real navigation link. Existing
   sign-in, travel and room eligibility remain necessary there.
5. Show future station/anomaly destinations as planned. Selection can explain
   their intended purpose, but cannot fabricate an available operation,
   participants, a countdown, a simulated live battle or an active event.
6. Keep Arena, Three.js and the station approach out of the initial static
   import graph. Respect reduced motion and phone layouts.

This slice is an implemented entry redesign and local gameplay connection.
It is **not** a claim of persistent infinite exploration, full engine migration,
live orbital multiplayer or actual spectator battle rendering.

## Expansion direction: extended cosmic universe

### Spatial continuity

Build toward planetary/orbital transitions, connected sectors, remote
destinations and long-distance navigation through bounded deterministic
generation and streaming. Floating-origin rendering and sector coordinates
must prevent precision loss. “Infinite” is the extensible product direction,
not a claim that an unbounded simulation is running today.

### Calculated cosmic events

Treat stellar events and anomalies as reproducible systems, not random UI
decoration. A future authoritative event contract should define:

- Stable event identity and definition version.
- Sector/location, spatial bounds and discovery visibility.
- Server epoch, deterministic seed, duration and lifecycle.
- Forecast precision and clearly differentiated predicted versus active state.
- Operation eligibility and a separately validated consequence policy.

The server determines lifecycle and eligible consequences. Clients may render
deterministic effects and forecasts from approved data. Do not invent schedules
or real-time event claims before this contract and its tests exist.

### Multiplayer locations

Asteroid competitions, orbital stations, co-op encounters and temporary events
should use the existing operation directory, authenticated instance ownership
and read-only observer contracts. Galaxy markers, nearby interpolated proxies
and detailed authorized spectating are distinct visibility levels.

Private room codes and private sessions remain outside public discovery.
Private/AI-fill restrictions and competitive reward gates remain unchanged.

## Ordered continuation

1. Verify this command/destination redesign on desktop and mobile without
   changing active flight controls.
2. Integrate account-backed location/discovery state into the same presentation
   through existing contracts; cached/local views remain explicit.
3. Continue versioned Orbital migration and safe universe-to-operation handoffs.
4. Build observer-safe real battle visibility with authenticated participants.
5. Implement tested deterministic anomaly/event scheduling and bounded sector
   expansion, then measure capacity and physical-device rendering performance.

## Additional Infinite Open Universe directive: requirement mapping

The subsequent [connected-universe integration](CONNECTED-UNIVERSE-INTEGRATION.md)
joins the shared chart to real account world state and operation discovery at
`/universe`, with explicit paid-travel confirmation and handoffs to existing
authorized destination controls. It preserves the independent offline entry.
This advances navigation integration, not continuous sector flight.

The requested full milestone is **launch from Mars → continuous sector
exploration → discover/investigate an opposing patrol → engage or evade →
discover a multiplayer installation → authorized activity entry → return to the
universe**. The current entry redesign does not demonstrate this whole loop.

| Phase | Current assessment and required completion evidence |
|---|---|
| A — Discovery/architecture | PARTIALLY IMPLEMENTED: saved source-backed architecture/extraction documents exist; the full new scope requires continued subsystem audits |
| B — Canonical engine | PARTIALLY IMPLEMENTED: shared Orbital primitives, pilot adapters and outcomes exist; duplicate orchestration and mode-owned scenes remain |
| C — Universe foundation | PARTIALLY IMPLEMENTED: existing world navigation and local spatial scenes; continuous multi-sector streaming and persistent procedural discoveries are not established |
| D — Living factions | NOT IMPLEMENTED at universe scale: faction/hull selection and opposing combat AI are not autonomous persistent faction ecosystems |
| E — Encounter director | NOT IMPLEMENTED: no verified world-level detection/investigation/identification/interception/warning/hostility/reinforcement/resolution director |
| F — Anomalies | NOT IMPLEMENTED: chart concepts do not supply interactive gravity, traversal, hazards or validated exploration outcomes |
| G — Multiplayer universe | PARTIALLY IMPLEMENTED: existing Wing/co-op/directory infrastructure retained; canonical Orbital multiplayer integration and full activity gateway remain incomplete |
| H — Full frontend | PARTIALLY IMPLEMENTED: this entry redesign and existing account/hangar surfaces are not an end-to-end redesign of every screen |
| I — Persistence/performance/security | PARTIALLY IMPLEMENTED: established server-owned services and safeguards remain; expanded-world persistence and mobile/server performance need new evidence |
| J — Full-game release | BLOCKED on unfinished capabilities and real acceptance evidence; no release readiness claim |

Apply the encounter lifecycle to both factions, with faction-specific decisions
based on real sensor/proximity/territory/threat/capacity state rather than
unconditionally spawning enemies. Preserve nearby detailed simulation versus
distant strategic updates. Local briefing text can reflect the selected pilot
and actual opposing AI, but must not claim these future systems already run.

The additional document does not authorize new reward policies for private,
AI-fill, anomaly, training or arcade paths. Eligibility and settlement remain
governed by existing server rules until separately reviewed.

## Release and rollback

Keep Production untouched. No deployment, schema replacement, auth-provider
change, new reward ledger or feature-flag enablement belongs to this visual
slice. Reverting its UI and styles restores the previous Lab entry without
changing stored player state or server simulation.
