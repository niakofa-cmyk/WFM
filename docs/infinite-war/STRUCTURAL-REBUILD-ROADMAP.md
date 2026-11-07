# WAR FOR MARS: THE INFINITE WAR — structural rebuild roadmap

## Phase 0 extraction audit

The latest user-provided rebuild direction requires the complete extraction
audit before more isolated prototypes. The current source-level audit is
[`ORBITAL-LAB-PHASE-0-FORENSIC-EXTRACTION-AUDIT.md`](ORBITAL-LAB-PHASE-0-FORENSIC-EXTRACTION-AUDIT.md).
It maps boot/runtime ownership, simulation imports, renderer lifecycle,
controls, authority, and real mode launch paths. Source inventory is complete;
automated path-contract tests and authenticated staging reconciliation remain
open proof gates.

The full user source is preserved at
[`references/ORBITAL-LAB-REBUILD-DIRECTION-SOURCE.txt`](references/ORBITAL-LAB-REBUILD-DIRECTION-SOURCE.txt).
Its priority is to make Orbital the actual WFM game engine, preserve working
authority services during migration, and execute mode migrations in sequence.

## First local runtime slice

The offline Orbital universe now has one Arena-owned exploration, deterministic
streamed local sectors, physical Cinder docking, training/debrief and
retained-flight return loop.
See [implementation and evidence](ORBITAL-LOCAL-UNIVERSE-SLICE.md).
Interactive browser certification is blocked by the test browser's unavailable
WebGL context; do not mark the full rebuild or online migration complete.

## Current precedence

The owner's controlling clarification is recorded in the
[Orbital universe rebuild contract](ORBITAL-UNIVERSE-REBUILD-CONTRACT.md).
The **game and its playable universe run inside the rebuilt Orbital foundation**;
Orbital must not remain a training side link beside a separately executed
universe. Break down the Lab's entry, simulation, rendering, controls and return
functions into the primary game runtime. Training becomes a subordinate
activity; existing runtimes remain compatibility/rollback paths until verified.
The target is one Orbital main foundation with distinct configurations and
authority adapters, not one monolithic multiplayer server. See the
[current engine architecture](engine/MASTER-ENGINE-ARCHITECTURE.md) and
[mode migration proof](engine/GAME-MODE-MIGRATION-MATRIX.md). The priority order
and checkpoints below are historical where they conflict with this directive.
For the updated renderer relationship and the new Mars route/adventure model,
see [Mars planetary routes and adventures](MARS-PLANETARY-ROUTES-AND-ADVENTURES.md):
keep Three.js as a renderer if the Orbital runtime owns it; do not preserve a
duplicate universe game or remove a renderer without parity and benchmark proof.

The complete owner-supplied source is preserved unchanged in
[`STRUCTURAL-REBUILD-STRATEGY.txt`](./STRUCTURAL-REBUILD-STRATEGY.txt).
The controlling full-game orbital migration source is preserved unchanged in
[`../../attached_assets/Pasted--WAR-FOR-MARS-THE-INFINITE-WAR-MASTER-ORBITAL-ENGINE-CO_1793798261341.txt`](../../attached_assets/Pasted--WAR-FOR-MARS-THE-INFINITE-WAR-MASTER-ORBITAL-ENGINE-CO_1793798261341.txt);
its maintained migration plan is
[`ORBITAL-ENGINE-CONSOLIDATION-DIRECTIVE.md`](./ORBITAL-ENGINE-CONSOLIDATION-DIRECTIVE.md).
The later repository-specific diagnosis is preserved unchanged in
[`REPO-UNIFICATION-REQUEST.txt`](./REPO-UNIFICATION-REQUEST.txt).
The current owner-supplied open-universe, Orbital Lab, structural-rebuild, and
multiplayer-universe briefs remain unchanged in `attached_assets/`:
`Pasted--War-for-Mars-Infinite-War-The-Infinite-Open-Universe-I_1793989681065.txt`,
`Pasted--War-for-Mars-Infinite-War-Orbital-Combat-Lab-Infinite-_1793990090269.txt`,
`Pasted--WAR-FOR-MARS-THE-INFINITE-WAR-structural-rebuild-strat_1793990237240.txt`,
and `Pasted--War-for-Mars-Infinite-War-Multiplayer-Universe-Archite_1793990650366.txt`.
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

- The final game uses Orbital Engine as its single gameplay and rendering
  foundation. The current Three.js implementation is a temporary renderer to
  migrate away from, not a permanent universe layer. Study its proven
  presentation techniques and reimplement them in Orbital; remove the package
  only after renderer parity, target-device performance, and rollback gates pass.
  See [Orbital Engine-only renderer rebuild](ORBITAL-ENGINE-ONLY-RENDERER-REBUILD.md).
- Re-engineer Orbital Combat Lab into the main playable universe runtime,
  retaining training as an internal activity and validation profile. Consolidate
  simulation/render/input ownership without flattening different mode rules;
  migrate authoritative operation adapters only after parity, networking,
  progression and rollback are proven.
- Retain Rust Disc, Mars Approach, Pale Beacons, Iron Eclipse, Arcade Skirmish,
  and Wing as distinct playable/authoritative experiences behind explicit
  operation entry points. Preserve their existing combat engines until a
  replacement is certified.
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
| C | Orbital flight/combat validation and per-operation runtime integration |
| D | Campaign briefings, objectives, debriefs, and validated progression |
| E | Connect existing cooperative sectors and Iron Eclipse |
| F | Integrate orbital combat with authenticated competitive Wing |
| G | Settle validated progression, economy, discoveries, and war consequences |
| H | Expand bounded fleet battles, AI, anomalies, and new sectors |

Each stage needs a working build, automated tests, explicit acceptance criteria,
and documented limitations before expanding scope.

## Latest owner priority order

1. **Command center:** establish the opening, game identity, and unified
   navigation into one connected universe.
2. **Hangar:** make the player's home the gateway for saved ship inspection,
   fleet/loadout selection, equipment, and launch.
3. **Combat-engine integration:** make Orbital Combat Lab the shared development
   and validation foundation, then connect operations through explicit,
   versioned adapters. Existing Rust Disc, Arcade, and Wing engines remain
   independent until each mode passes migration and rollback gates.
4. **Universe destinations:** connect Mars, Cinder Ring, sectors, exploration,
   multiplayer stations, and anomalies through real travel and operation
   discovery. Cinder Ring is the first physical competitive hub; additional
   destinations must publish only server-confirmed activities.
5. **Settings:** unify persistent flight controls, graphics, audio,
   accessibility, and HUD preferences.

## First unified playable slice

1. Introduce the Mars conflict and the USSF/Accord stakes.
2. Choose a faction and configure a saved ship/loadout in the 3D Hangar.
3. Select Rust Disc from universe/operations navigation.
4. Launch the correct operation-specific combat runtime and complete an
   objective through targeting, weapons, damage, and extraction. Promote Orbital
   combat for that operation only after its compatibility gate passes.
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

Cinder Ring is now a physical universe destination with a local flightable
approach and a slow/aligned docking gate before the station hub opens when the
available world snapshot places the pilot there. That can be cached location
state, so it is a presentation gate rather than fresh server authorization. The
approach reuses the Orbital spatial-flight integrator and saved ship model, but
it is no-reward navigation; the 5v5 and private-room flows retain their separate
existing authority and combat runtimes. Other multiplayer destinations,
shared-world free flight, and live combat rendered during approach remain
future work.

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

### Persistent universe signal layer

The first Layer A increment keeps the world-navigation and combat-authority
boundaries separate. Signed-in clients refresh a short-lived presence lease
while the Galaxy navigation screen is active; the client stops heartbeats when
launching an operation. The API derives the location from saved world state
rather than accepting a client-supplied destination. Public consumers receive
only grouped, destination-level pilot counts. Expired leases are excluded from
counts and pruned during directory refreshes.

The Galaxy screen now surfaces public operation events and active destination
counts from the existing operation directory/SSE stream, including each
operation's declared runtime. It does not create activity, reveal account
identities, or merge combat systems. Existing travel and station hubs remain
the entry points into each independent runtime.

The additive universe-presence schema migration has been applied to the Replit
Development database and verified with an isolated, temporary presence probe.
No Railway staging or Production database was changed. If the table is absent
during a staged rollout, operation events remain available and the directory
reports presence as unavailable.
This increment does not provide exact nearby ship positions, continuous shared
3D free flight, or new station/asteroid destinations; those require separate
server-authoritative work and verification.
