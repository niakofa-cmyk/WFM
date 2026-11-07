# WAR FOR MARS: THE INFINITE WAR — structural rebuild roadmap

The complete owner-supplied source is preserved unchanged in
[`STRUCTURAL-REBUILD-STRATEGY.txt`](./STRUCTURAL-REBUILD-STRATEGY.txt).
The later repository-specific diagnosis is preserved unchanged in
[`REPO-UNIFICATION-REQUEST.txt`](./REPO-UNIFICATION-REQUEST.txt).
This maintained guide summarizes its decisions and applies them to the current
codebase. The source document remains authoritative if this summary and the
original differ.

## Product direction

**The universe is the battlefield.** The player should enter one connected
world, belong to one faction, configure one ship, take operations in that world,
and return to a hangar where validated outcomes create the next opportunities.
Campaign, cooperative play, competitive warfronts, exploration, economy, and
progression are activities within one game—not separate games presented as
unrelated menu commands.

The target is an authored, expandable universe with bounded simulations, not an
unbounded count of live ships or a literally infinite galaxy.

## Preserve before replacing

- Keep the custom Three.js/Vite runtime as the initial foundation. Needle remains
  a research/authoring candidate, not a second production runtime.
- Evolve Orbital Combat Lab into the canonical combat foundation; consolidate
  overlapping flight rules only after parity and rollback are proven.
- Retain Rust Disc, Mars Approach, Pale Beacons, and Iron Eclipse as flight,
  exploration, and cooperative operation content.
- Retain the existing authenticated 5v5 Wing matchmaking, reward ledger,
  account isolation, reconnect behavior, and private/AI-fill boundaries.
- Retain the existing campaign, Armory, market, inventory, persistent Galaxy,
  and account-scoped progression. Connect them incrementally rather than
  creating duplicate player tables, auth systems, ledgers, or matchmakers.
- Never retire a working path until its replacement, data compatibility, tests,
  and rollback are proven.

The repository-specific request correctly identifies that the phone command
screen presents separate systems with too much equal visual weight. Its
suggestion to scrap the older flows is not a safe first step: campaign, Wing,
and cooperative paths have different verified account, server, and reward
contracts. Consolidate the player-facing hierarchy first, then migrate one
runtime/operation contract at a time without presenting unintegrated systems as
already unified.

## Delivery sequence

| Stage | Goal |
| --- | --- |
| A | Forensic inventory and architecture assessment |
| B | Unified opening, hangar, operations, and universe navigation |
| C | Canonical orbital flight, targeting, weapons, damage, and readable feedback |
| D | Campaign briefings, objectives, debriefs, and validated progression |
| E | Connect existing cooperative sectors and Iron Eclipse |
| F | Integrate orbital combat with authenticated competitive Wing |
| G | Settle validated progression, economy, discoveries, and war consequences |
| H | Expand bounded fleet battles, AI, anomalies, and new sectors |

Each stage needs a working build, automated tests, explicit acceptance criteria,
and documented limitations before expanding scope.

## First unified playable slice

1. Introduce the Mars conflict and the USSF/Accord stakes.
2. Choose a faction and configure a saved ship/loadout in the 3D Hangar.
3. Select Rust Disc from universe/operations navigation.
4. Launch the canonical 3D combat runtime and complete an objective through
   targeting, weapons, damage, and extraction.
5. Debrief, return to the Hangar, and apply account progression only from a
   validated server result.
6. Unlock the next story operation through the existing account progression.

This is not complete merely because its screens or isolated simulations exist.
The end-to-end flow, server authority, account preservation, and device behavior
must each be verified.

## Mandatory authority and safety

- Clients may render, predict, and animate; they do not decide competitive
  damage, outcomes, mission completion, rewards, or persistent war state.
- Ten distinct authenticated humans are required for reward-eligible 5v5.
  Private rooms and AI-fill remain separate and no-reward.
- Mission/claim retries must be idempotent. Incomplete, interrupted, replayed,
  and invalid outcomes must not produce progression or credits.
- Keep new gameplay bounded, deterministic, synchronized, and behind the
  appropriate feature flags. Test mobile rendering separately from network and
  server behavior.
- Do not claim features are integrated, deployed, or device-verified based only
  on a build or simulation test.

## Current implementation checkpoint

As of 2026-11-04, PR #11 remains an open draft against `staging`. It selectively
integrates the orbital combat foundation without replacing the staging
authentication/socket contracts. The custom runtime and server-owned
cooperative/competitive safeguards remain in place.

Recent player-journey work carries the saved Hangar hull into the local Rust
Disc briefing and explicitly keeps that trainer no-reward and non-persistent.
The Galaxy now identifies the next incomplete story-sector operation from
recorded flight discoveries and carries its mission ID into Expedition. The
Expedition selector accepts that navigation hint, but existing account-progress
and server prerequisite checks remain authoritative.

The public landing now emphasizes account entry or local solo flight and groups
the alternate Rust Disc, Combat Lab, and co-op routes in an expandable
operations panel. The signed-in mobile command screen presents the campaign as
the primary operation, keeps server-run co-op visible as another operation
path, and groups local Rust Disc, offline Combat Lab, and alternate Arcade
entry points in an expandable Flight & Combat Systems section. All previous
routes remain available; this is a navigation consolidation, not evidence that
their simulation runtimes have already been merged.

The first unified campaign-to-validated-progression loop, shared 10-human
orbital 5v5, persistent faction consequences, and mobile-device acceptance
remain incomplete until their specific gates pass. PR #11 being open or passing
workspace checks does not establish those capabilities.

### Incremental campaign-combat migration

The first campaign operation now uses the canonical orbital combat runtime:
clients advertise orbital-replay support, and the server selects `orbital-v1`
for capable Contact runs. Older clients that omit the capability and all other
campaign runs use `surface-v1`; runs issued before model versioning also default
to that legacy behavior.
Contact resolves through its “break the defending wing” branch. Standalone
Combat Lab remains local/no-reward, and competitive Wing, cooperative sectors,
Iron Eclipse, and the socket protocol are unchanged.

This advances one bounded campaign slice, not the complete Stage C–D journey.
Automated client/server replay and reward-claim checks are not staging, phone, or
Production verification. Do not promote the change until its exact staging
revision passes the appropriate authenticated campaign and reward checks.


## Owner clarification — the Orbital Lab is being rebuilt into the actual game

The owner clarified that the complete universe and game must run **inside the Orbital Combat Lab-derived runtime**. It is not enough to consolidate menus, embed the old universe application, or keep Lab as a standalone arena. The Lab's end-to-end lifecycle and functions are the starting foundation to be deconstructed, generalized, and rebuilt as WFM's primary runtime.

The intended first release is a Mars-centered navigable theater. Mars is the central stage and starting strategic hub; expansion proceeds to moons, stations, asteroid regions, other planets, star systems, galaxies, anomalies, dimensions, and distinct universes. Each destination must be an actual spatial/gameplay location with travel, encounters, operations, and meaningful persistence—not decorative map content.

The detailed owner-directed implementation prompt, including the function inventory, target architecture, anomaly framework, source-system migration map, mobile controls, phases, acceptance gates, and definition of done, is maintained in
[ORBITAL-LAB-UNIVERSE-REBUILD-DIRECTIVE.md](./ORBITAL-LAB-UNIVERSE-REBUILD-DIRECTIVE.md).

### Updated rebuild sequence

| Phase | Goal |
| --- | --- |
| 0 | Function-by-function Lab audit; inventory all legacy systems, contracts, tests, and rollback paths |
| 1 | Transform Lab boot/lifecycle into the primary WFM shell: hangar → Mars universe → operation → debrief → return |
| 2 | Unify Rust Disc pilot controls, flight physics, Orbital Lab combat, targeting, weapons, damage, and AI |
| 3 | Build Mars surface/orbit and local system as real streamed, navigable spaces |
| 4 | Migrate campaign, co-op, Iron Eclipse, and Wing into one operation lifecycle while preserving distinct authority/reward rules |
| 5 | Connect persistent faction conflict, economy, discoveries, and world consequences |
| 6 | Expand to additional planets and solar-system destinations |
| 7 | Expand to star systems, galaxies, anomalies, dimensions, and other universes |
| 8 | Scale fleet warfare and live cosmic events after capacity and integrity gates |

The prior stages A–H remain useful as integration categories, but this owner clarification changes the runtime destination and adds explicit world-scale architecture. Do not interpret “inside the Lab” as an iframe or as permission to discard the existing game infrastructure. Reuse the Lab's Three.js/Vite foundation and migrate verified systems one at a time.

**Current status:** this is a saved architectural direction and implementation directive, not proof that the runtime has already been rebuilt. The current code still has distinct local Lab, Rust Disc, co-op, campaign, and Wing paths until the phases above are implemented and verified.


## Mars routes redesigned as live geography and adventures

The route redesign is specified in
[MARS-LIVE-ROUTES-AND-ADVENTURE-NETWORK.md](./MARS-LIVE-ROUTES-AND-ADVENTURE-NETWORK.md).
Treat Rust Disc, Mars Approach, Pale Beacons, Night-side, Dust Lane, Mars Signal, Phobos Yard, Outer Fringe, Deep Nebula and Iron Eclipse as regions, travel corridors, points of interest and operation frameworks inside the same streamed Mars/universe runtime.

The first spatial proof should be a continuous day-side → night-side → day-side Mars circumnavigation with authoritative Mars rotation/time, coordinate-frame conversions, streamed sector handoff, one physical point of interest, one dynamic event and no player-state discontinuity. Multiplayer claims require at least two authenticated pilots sharing the same authoritative sector and consistent event state.

Keep Three.js as the renderer. Extract/adapt useful capabilities from any separate universe prototype, but retire only its duplicate app/runtime after parity, device performance, multiplayer, resource-disposal and rollback gates pass.
