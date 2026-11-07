# Orbital Combat Lab to WAR FOR MARS: INFINITE WAR
## Canonical universe-engine rebuild and implementation directive

**Status:** Owner clarification captured; architecture and implementation directive. This document does not claim the runtime rebuild has been implemented.

**Repository baseline inspected:** staging at 3663e144938ba931cccaa624004814ab0fd65ff1 (2026-11-04).

**Primary rule:** Orbital Combat Lab is the starting code foundation to be deconstructed, expanded, and rebuilt as the actual WAR FOR MARS: INFINITE WAR game runtime. It is not to remain a separate offline training product that merely hosts links to the rest of the game.

## 1. Owner's clarified direction — supersedes the narrower interpretation

The owner explicitly clarified that the complete game and its universe are to be played **inside the rebuilt Orbital Combat Lab runtime**. The Lab's end-to-end functions, lifecycle, simulation, controls, rendering, scene management, camera, weapons, damage, AI, HUD, and build entry are to be audited and restructured as the new primary game foundation.

This is a runtime transformation, not a menu consolidation and not an iframe/embed. Do not simply place the old universe screen beside the Lab, link to legacy routes, or keep the Lab as a small arena with a galaxy menu wrapped around it.

The new product is **WAR FOR MARS: INFINITE WAR — USSF vs. the Accord**:
- Mars is the central stage, first major theater, narrative anchor, and initial strategic hub.
- The playable universe expands outward through moons, orbital infrastructure, asteroid belts, stations, planetary systems, star systems, galaxies, anomalous regions, dimensions, and eventually distinct universes.
- Destinations must become meaningful navigable and playable spaces with real travel rules, encounters, activities, mission hooks, and persistent consequences—not decorative spheres or a static map.
- The universe is the battlefield. Exploration, campaign, co-op, competitive operations, fleet warfare, economy, discovery, faction conflict, and progression belong to one connected game.
- The game should feel vast and open-ended while using bounded, streamable simulation spaces. “Infinite” is a content, discovery, and expansion promise—not a requirement to simulate infinite coordinates, entities, or players simultaneously.

This directive clarifies the target architecture. It does not authorize deleting working legacy code before its replacement is integrated and verified.

## 2. What the current repository proves — and does not prove

At the inspected staging revision:
- artifacts/war-for-mars/combat-lab.html and src/combat-lab.tsx provide a distinct Lab entry and offline/no-reward operation lifecycle.
- The Lab reuses the WFM custom React/Vite/Three.js application and existing Arena/input/simulation modules, with an opt-in orbital combat path.
- Orbital flight, weapons, damage, simulation orchestration, and procedural visuals exist as separate modules. The Lab has six-axis flight, target acquisition, missiles, collision, armor/hull damage, effects, telemetry, touch/desktop controls, and a local debrief/relaunch loop.
- The deterministic shared lib/orbital-sim package and server orbital modules provide a separate foundation for versioned simulation and authoritative operation work.
- Rust Disc local flight, authenticated Sector Expedition, Iron Eclipse, campaign, Wing matchmaking, account progression, Galaxy, and persistent world/economy services already exist in distinct forms.
- Local Rust Disc training is not the same runtime or authority boundary as server-run co-op. Offline Lab completion does not grant rewards. Competitive Wing and co-op do not become integrated merely because they share visual assets or a menu.

The inspected source and documentation do **not** prove that the full game already runs inside the Lab. They do not prove seamless galaxy travel, persistent real-time universe simulation, a shared multiplayer open world, all planets/galaxies/dimensions, synchronized anomalies, or a unified 3D multiplayer warfront.

Before implementation, refresh the branch tip and repeat source, test, deployment, and data-contract audits. Do not treat this 2026-11-04 baseline as current indefinitely.

## 3. Target architecture: one game runtime, layered universe simulation

Build one primary game runtime with clear boundaries:

1. **Universe directory and strategic layer** — canonical IDs and relationships for universes, dimensions, galaxies, star systems, planets, moons, orbital zones, sectors, stations, routes, anomalies, factions, and operations.
2. **Travel and streaming layer** — local movement, orbital transitions, atmospheric entry/exit, landing/takeoff where supported, jump corridors, gates, wormholes, dimensional transitions, sector loading, and seamless-feeling handoffs.
3. **Local simulation layer** — bounded high-fidelity physics and combat around the active player/operation. Use local coordinates, floating-origin/origin rebasing, hierarchical coordinates, deterministic sector seeds, and streaming; never rely on one enormous low-precision world coordinate.
4. **Shared world and multiplayer layer** — authenticated sessions, nearby-player presence, parties, AI fleets, operation discovery/join rules, snapshots, prediction/interpolation, reconnect, instance boundaries, and server authority.
5. **Combat and gameplay layer** — flight, ship handling, sensors, target selection, weapons, missiles, countermeasures, shields, armor, hull, subsystem damage, AI doctrine, squad orders, objectives, extraction, and destruction.
6. **Persistent campaign and strategy layer** — account identity, saved hull/loadout, inventory, discoveries, missions, faction standing, economy, unlocks, warfront state, and validated consequences.
7. **Presentation layer** — the existing Three.js renderer, materials, lighting, planetary visuals, cockpit/HUD, camera, audio, VFX, animation, accessibility, and mobile input. Presentation must consume canonical world/simulation state rather than invent gameplay facts.

Use the existing custom Three.js/Vite runtime as the initial renderer and application foundation. Do not introduce a parallel engine or replace Three.js simply because the universe becomes larger. Evaluate any engine migration separately with measured reasons and a migration/rollback plan.

### Scale model

Represent the universe as a hierarchy, not one giant scene:

Universe → Dimension/Reality → Galaxy → Star System → Celestial Body/Orbital Region → Sector/Instance → Local Coordinates

A player can traverse the hierarchy through physically presented travel sequences and bounded transitions. At each level, only the relevant nearby world, players, AI, hazards, and operations are simulated at full fidelity. Distant systems can use strategic summaries, scheduled events, deterministic state, and lightweight presence.

## 4. Mars-first world design

Mars is the first fully authored theater and the place where the player learns the game's language.

Build outward in coherent rings:

- **Mars surface and near-space:** major regions, bases, canyons, craters, contested installations, atmospheric flight zones, landing/extraction sites, hidden facilities, and story-critical locations.
- **Mars orbital theater:** orbital stations, shipyards, defense platforms, relays, debris fields, moons/nearby bodies, patrol routes, fleet assembly, and orbital battle zones.
- **Local system:** Phobos/Deimos and other selected destinations, asteroid belts, resource sites, transfer routes, research outposts, and deep-space operations.
- **Solar-neighborhood expansion:** additional planets and moons, each with distinct gravity, atmosphere, terrain, hazards, resources, cultures/factions, mission types, and strategic value.
- **Interstellar expansion:** star systems, jump routes, frontier settlements, alien/unknown structures, long-range logistics, and contested corridors.
- **Galactic and extra-dimensional expansion:** distinct galaxies, realities, dimensional pockets, and alternate-universe theaters, each with unique traversal rules, physics modifiers, civilizations, threats, and narrative consequences.

Do not generate empty planets merely to increase a destination count. Every released destination must have a gameplay purpose, readable identity, authored points of interest, systemic activity, and an expansion path.

## 5. Anomalies are gameplay systems, not scenery

Create a versioned anomaly framework. Each anomaly definition must specify:
- spatial bounds and activation conditions;
- visual/audio signature and sensor discoverability;
- deterministic or server-authoritative effect rules;
- affected systems (navigation, gravity, time, sensors, weapons, shields, communications, energy, AI, or travel);
- interaction and counterplay;
- mission hooks, rewards/risks, faction relevance, and persistence rules;
- client/server parity, replay determinism, bandwidth budget, and fallback behavior.

Initial anomaly families to evaluate and stage:
- gravity wells, unstable mass fields, orbital perturbations;
- wormholes, spatial rifts, jump gates, unstable transit corridors;
- electromagnetic storms, solar flares, radiation belts, plasma clouds;
- nebulae, sensor shadows, communications disruption, ionized gas;
- time dilation or temporal distortion zones, carefully bounded and synchronized;
- dimensional fractures, alternate-reality overlaps, phase-shift regions;
- ancient megastructures, dormant gateways, unknown signals, living/cosmic phenomena;
- asteroid swarms, debris cascades, rogue bodies, planetary weather and atmospheric hazards.

An anomaly must change a decision or create a meaningful encounter. It must not be only a shader, particle effect, or map icon. Competitive effects must be bounded, fair, visible, testable, and server-authoritative.

## 6. The Lab transformation — deconstruct, map, migrate, replace, certify

Perform a function-by-function audit of the complete Lab flow before changing it. Inventory entry HTML/build configuration, boot/loading/error states, React lifecycle, Arena initialization, simulation tick, input sampling, fixed-step timing, flight model, weapons, target acquisition, damage, AI, collision, camera, HUD, sound, VFX, pause/resume, reset, debrief, replay/relaunch, resource disposal, and teardown.

For every function, record:
- current source path and owner;
- dependencies and callers;
- whether it is reusable, needs an adapter, must be redesigned, or can be retired;
- current offline/local assumptions;
- desired universe-game behavior;
- client/server ownership;
- tests and parity requirements;
- migration steps and rollback path.

Then transform the Lab entry from a self-contained offline training lifecycle into the primary game boot/runtime lifecycle. Preserve the Lab's useful six-axis combat and rendering work, but generalize its scene and simulation contracts so it can host the full game. The first screen after boot should lead into the actual WFM universe journey (title/briefing as designed → faction/identity → hangar → Mars theater), not strand the player in a training arena.

Do not just expand the Lab's arena radius. Replace the single-arena assumption with a world/sector host that can load and unload locations, transition between scales, and attach gameplay operations to real universe coordinates.

## 7. Existing systems to absorb into the new runtime

These are source systems to extract from, adapt, and integrate—not independent destinations that remain disconnected:

| Existing source | Capability to migrate into the unified runtime |
| --- | --- |
| Orbital Combat Lab / Arena | Canonical local 3D combat presentation, flight controls, aiming, weapons, damage feedback, HUD, camera, effects, lifecycle |
| Rust Disc local trainer | Original responsive pilot feel, momentum, thrust, braking, boost, drift, camera behavior, landscape mobile controls, environmental navigation |
| Sector Expedition | Authenticated co-op flight, server-owned state, shared objectives, snapshots, reconnect, discoveries and mission progression |
| Operation Iron Eclipse | AI wing roles/orders, escort/defend/attack/regroup, capital-ship engagements, subsystem targeting, extraction and mission phases |
| Campaign/Strike | Narrative operations, briefings, objective chains, debrief and progression |
| Competitive Wing | Matchmaking, fair-team rules, server-authoritative outcomes, rewards, reconnect and competitive integrity |
| Galaxy/world/economy | Real destinations, travel gates, stations, markets, salvage, contracts, faction standing, discoveries and persistent world services |
| Hangar/Armory | One saved ship/loadout, ship roles, modules, upgrades, repairs and player preparation |

Do not duplicate identity, profiles, inventory, credits, rewards, matchmaking, or progression stores. Reuse and version existing APIs and data contracts. If a contract must change, migrate frontend, API, socket, persistence, and clients as one coordinated, backward-compatible release.

## 8. One player journey and one operation model

The canonical journey is:

1. Boot the WFM runtime and load account/guest capabilities safely.
2. Enter the narrative and choose/confirm USSF or Accord allegiance.
3. Enter the 3D hangar with the saved ship, loadout, squad, and readiness.
4. Open the Mars-centered universe from the hangar, cockpit, or navigation interface.
5. Fly locally, travel between valid destinations, discover signals, encounter NPC/AI forces, and locate operations.
6. Join an operation from the world when eligible; show its location, teams, rules, risk, status, and join permissions.
7. Load the operation's bounded authoritative instance without losing the fiction of being in the same universe.
8. Complete objectives using the same canonical flight/combat rules.
9. Receive a server-validated debrief; update discoveries, campaign, inventory, faction standing, and war consequences exactly once where eligible.
10. Return to the same world/hangar context with new opportunities and visible consequences.

Operations can be solo campaign, local practice, AI squad, private co-op, public co-op, competitive 5v5, larger fleet battles, escort, reconnaissance, rescue, defense, assault, salvage, exploration, anomaly research, and world events. Each operation type must declare eligibility, authority, player limits, reward policy, reconnect behavior, and persistence effects. Local/offline training remains available as training but cannot grant online rewards.

## 9. Multiplayer and authority

The universe may appear shared and persistent, but the implementation must use bounded, manageable server instances:
- server-owned position/velocity validation, weapon fire, hit/damage, destruction, objectives, match results, and rewards;
- authenticated identity from existing Clerk/session contracts;
- versioned simulation and network protocols;
- client prediction and interpolation only for responsiveness;
- deterministic replay or authoritative reconciliation for competitive outcomes;
- explicit interest management, spatial partitioning, rate limits, entity caps, and per-sector budgets;
- reconnection and recovery for sessions and operations;
- instance transfer with validated handoff and no duplicate player/entity authority;
- idempotent result settlement and account isolation.

Do not promise unlimited concurrent players, 100v100, or thousands of active ships as current capabilities. Scale through shards/instances, shared strategic state, AI simulation tiers, and staged capacity tests. Private/AI-fill and local modes retain their existing no-reward boundaries unless explicitly certified.

## 10. Mobile-first flight and combat

Preserve the original Rust Disc landscape-screen pilot experience as a core control reference. The Orbital Lab's current nine-button maneuver grid must not automatically become the permanent flight UX. Reuse the tested Rust Disc thumb layout and response characteristics, adapting it to the canonical input schema.

Target direction:
- left thumb: primary flight axes and maneuvering, with mode-aware mapping for atmospheric and space flight;
- right thumb: aim/camera and combat interaction;
- compact, accessible boost/brake/ability actions where gestures cannot replace them reliably;
- simultaneous multi-touch, pointer capture, neutral/release behavior, safe-area handling, landscape-first combat, and clear portrait recovery where supported;
- optional gyro/assist settings only where device-tested;
- preserve all maneuver capability; do not remove an action until its replacement passes control and regression tests.

Flight should preserve momentum, inertia, thrust, pitch/yaw/roll, strafe/lift, drift, boost, braking, stabilization/assist, and hull-specific handling. Atmosphere, orbit, and deep space can use different parameter profiles under one versioned control/physics contract.

## 11. Delivery sequence and gates

**Phase 0 — Full forensic extraction map**
- Audit every Lab function and every legacy source subsystem.
- Produce dependency graph, route/entry map, data-contract map, test inventory, visual inventory, and migration/rollback matrix.
- Establish verified baseline for clean install, typecheck, tests, normal build, Lab build, browser smoke, and target-device profile.

**Phase 1 — Rebuild Lab as the primary WFM shell**
- Make the Lab runtime boot into the canonical WFM game flow.
- Preserve combat training as an explicitly selectable no-reward activity, not the primary app.
- Add canonical game state, scene/sector host, lifecycle, loading/error/recovery and navigation.
- Acceptance: player can boot, enter hangar, load a Mars scene, launch the first operation, complete/debrief, and return without navigating to another app/runtime.

**Phase 2 — Canonical pilot and combat**
- Port Rust Disc controls/flight feel and reconcile orbital combat into one input and simulation contract.
- Integrate ship identities, weapon systems, target/damage/subsystem feedback and AI.
- Acceptance: full flight/combat control matrix, all hulls, deterministic/replay checks, and mobile browser/device tests.

**Phase 3 — Mars as a real navigable theater**
- Implement Mars surface/orbit zones, moons, stations, bases, relays, asteroid regions, travel lanes and actual spatial collision/navigation.
- Acceptance: fly between multiple meaningful destinations, enter/exit supported zones, discover and interact with objects, stream sectors without broken continuity.

**Phase 4 — Unified operations and multiplayer**
- Migrate campaign, Sector Expedition, Iron Eclipse, and Wing into a common operation lifecycle with their distinct rules retained.
- Acceptance: authenticated pilots share a sector, see/enter eligible operations, reconnect, complete server-validated objectives, and receive correct debrief/progression.

**Phase 5 — Persistent Mars war**
- Connect faction control, supply, economy, discoveries, events, and operation consequences to existing durable services.
- Acceptance: repeatable, idempotent, account-isolated state changes visible after reload/re-entry.

**Phase 6 — Solar-system expansion**
- Add planetary destinations, orbital mechanics profiles, environmental hazards, distinct activities, and logistics.
- Acceptance: actual travel and playable operations at more than one celestial body, not just map unlocks.

**Phase 7 — Interstellar, galactic, dimensional expansion**
- Add star systems, galaxies, wormhole/rift networks, dimensional spaces, alternate realities, and universe-scale narrative arcs.
- Acceptance: versioned travel transitions, persistent discovery, distinct mechanics, synchronized multiplayer effects, and bounded server costs.

**Phase 8 — Fleet warfare and live cosmic events**
- Scale AI wing/fleet composition, capital ships, large operations, spectator systems, tournaments, and world events only after capacity and integrity tests.

Each phase must be a playable vertical slice, not a placeholder. Each requires automated tests, server/client parity, security review, performance budgets, staging evidence, mobile verification where applicable, documentation, feature flags, and rollback.

## 12. Required deliverables from the expert gaming AI

Before coding, deliver:
1. exact current-branch commit and status;
2. full Lab function-by-function inventory;
3. all existing game subsystem inventory and source map;
4. current architecture diagram and target architecture diagram;
5. runtime/data/network contract map;
6. migration matrix: reuse / adapt / rewrite / retire-after-parity;
7. risk register and dependency ordering;
8. phase-by-phase task breakdown with files, tests, owners, acceptance criteria, and rollback;
9. first playable vertical-slice definition.

Then implement the smallest complete vertical slice, not another disconnected prototype. After each slice, report changed files, commands actually run, results, browser evidence, server/staging evidence, known gaps, and rollback instructions.

## 13. Non-negotiable constraints

- Do not build a second game, second renderer, second account system, second universe database, or parallel progression system.
- Do not treat a galaxy map, distant planet mesh, starfield, or portal effect as a playable universe.
- Do not claim “infinite universe,” seamless planetary landing, persistent shared multiplayer, live 5v5 integration, or physical-device readiness without evidence.
- Do not delete old systems or data before their replacement is integrated, tested, migrated, and rollback-safe.
- Do not trust client-submitted damage, location, mission completion, inventory, currency, faction consequences, or reward amounts.
- Do not bypass Clerk, production security, staging gates, or release approval.
- Work on an isolated review branch and staging first. No Production deployment, database migration, main promotion, or destructive cleanup without explicit authorization.
- Keep the USSF identity blue and the Accord identity warm amber/solar; do not conflate faction palette with friendly/hostile status.

## 14. Definition of done

The rebuild is not complete when the Lab screen is renamed or the galaxy is visible. It is complete only when the Orbital Lab-derived primary runtime demonstrably hosts one coherent game in which a player can:
- enter the game and hangar;
- launch and fly a ship using the intended pilot controls;
- navigate a real Mars-centered 3D theater with meaningful destinations;
- encounter AI and other authenticated players;
- discover and join operations in-world;
- use shared flight/combat rules across campaign, co-op, and competitive operations;
- travel between streamed sectors and supported celestial bodies;
- experience anomalies with real, synchronized gameplay effects;
- complete objectives and receive server-validated results;
- see durable, idempotent progression and faction/world consequences;
- continue outward through new systems and, later, galaxies and dimensions without switching to another game or runtime.

**The universe is the game. Orbital Combat Lab is the foundation being transformed into that game—not a separate destination alongside it.**
