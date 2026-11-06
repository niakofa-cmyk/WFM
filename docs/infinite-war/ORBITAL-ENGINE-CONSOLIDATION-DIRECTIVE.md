# WAR FOR MARS: THE INFINITE WAR — canonical orbital runtime

## Owner reference

The complete owner-provided directives are preserved unchanged at
[`../../attached_assets/Pasted--WAR-FOR-MARS-THE-INFINITE-WAR-MASTER-ORBITAL-ENGINE-CO_1793798261341.txt`](../../attached_assets/Pasted--WAR-FOR-MARS-THE-INFINITE-WAR-MASTER-ORBITAL-ENGINE-CO_1793798261341.txt)
and the later
[`../../attached_assets/Pasted--MASTER-DEVELOPMENT-DIRECTIVE-WAR-FOR-MARS-INFINITE-WAR_1793819815572.txt`](../../attached_assets/Pasted--MASTER-DEVELOPMENT-DIRECTIVE-WAR-FOR-MARS-INFINITE-WAR_1793819815572.txt).
The later directive controls the engine end state; this companion records the
code-backed stages and safeguards.

## Direction update — one universe, compatible specialist runtimes

The latest owner directive makes Orbital Combat the eventual shared gameplay
engine for Rust Disc, Iron Eclipse, Route to Mars, Arcade, campaign, co-op, and
competitive operations. Rust Disc remains a distinct operation and must keep its
current entry available until its canonical-engine migration is proven; its
validated controls, handling, environment, and mission capabilities are to be
extracted through reusable systems and versioned adapters. Do not force
incompatible physics settings into one profile.

**One main engine. One connected universe. Multiple operation configurations.**

Existing identity, room ownership, matchmaking, mission adjudication, world
state, loadouts, progression, rewards, and idempotency remain owned by their
current authoritative services. Orbital Combat Lab training remains no-reward.

## Migration contract

1. The `lib/orbital-sim` package owns the canonical deterministic orbital
   combat rules and is the migration target. Existing versioned runtimes remain
   only as compatibility and rollback paths until their operation adapters pass.
2. Every issued multiplayer or campaign run declares its simulation/runtime
   version. A running or previously issued run is never silently reinterpreted.
3. A mode is connected only when its actual runtime, objectives, outcomes and
   authority path are represented by a versioned operation contract.
4. Client prediction and rendering may differ, but networked movement, weapon
   validation, damage, AI, objectives, results and eligible settlement must be
   authoritative for that operation's pinned runtime and ruleset.
5. Migrate client, API and socket contracts together behind a version/capability
   boundary. Preserve legacy replay for already-issued runs and keep rollback
   until acceptance passes.
6. Do not remove a legacy implementation until its callers and stored-run
   dependencies have migrated, client/server parity and regression tests pass,
   and rollback is proven.

## Current code-backed status — 2026-11-04

| Mode/system | Current runtime/authority | Required migration |
|---|---|---|
| Orbital Combat Lab | Offline `Arena` using `lib/orbital-sim`; no reward settlement | Keep as the canonical engine test harness and no-reward trainer |
| Offline Solo Flight | Still uses `surface-v1`; its attempted orbital switch did not pass the playable 3D browser gate and was reverted | Resolve and pass the graphics/controls gate before migrating this entry point |
| Offline `WarApp` Arena practice | `orbital-v5`; server-issued runs remain pinned to their original runtime | Extend this offline migration to local operation content |
| Rust Disc local flight | Local `App` entry opts into `orbital-motion-v1` for kinematics through a cached adapter; sector objectives, projectiles, collision damage, and renderer remain in `flight-sector.ts` | Finish weapons/objective migration with parity; retain networked `sector-motion-v1` as rollback and compatibility path |
| Sector Expedition / Iron Eclipse | Authenticated sector socket and a separate sector flight contract | Adapt the server-owned sector runtime and objectives to canonical orbital state |
| Offline Arcade Skirmish | Canonical `orbital-v5` in `Arena`; local and no-reward | Complete this local migration; preserve objective semantics and keep server-issued runs separate |
| Legacy campaign sorties | Pinned `surface-v1` compatibility in `Arena` | Migrate one server-issued mission at a time while preserving its issued runtime, replay and claim semantics |
| Campaign Contact | Versioned `orbital-v5` server replay for capable clients; earlier issued runs retain their recorded runtime | Preserve compatibility while expanding validated orbital mission coverage |
| Online Wing / private / AI-fill | Existing authenticated socket and matchmaking; orbital `Arena` currently rejects live rooms | Coordinate client, API and socket protocol migration; retain all room/reward safeguards |
| Hangar, Galaxy, Market, account progression | Existing account- and server-backed services | Feed their saved configuration and validated outcomes into the shared operation lifecycle |

The code above is a partial foundation, not a completed consolidation. The local
Rust Disc movement slice does not migrate its weapons or mission rules; a runtime
identifier or an orbital renderer is not proof that a mode has fully migrated.

The first consolidation safeguard is now implemented: browser and server code
share the `orbital-v1` / `surface-v1` runtime identities from `lib/orbital-sim`,
and every `Arena` caller must specify its runtime explicitly. Combat Lab selects
the canonical orbital runtime. Other callers are explicitly marked as legacy
until their gameplay and authority contracts migrate; this is an auditability
gate, not a claim that those modes are already orbital.

## Ordered implementation stages

1. Complete the mode/entry-point/runtime/authority inventory and make the
   migration matrix executable in tests.
2. Lock the shared simulation identity, deterministic traces and
   client/server/replay parity gates.
3. Extract Rust Disc flight/control/environment capabilities into Orbital
   operation configurations. Keep the current sector runtime as a rollback
   path; migrate Arcade and local training to the canonical engine, keeping
   them no-reward.
4. Migrate every campaign sortie with mission-specific objective adapters and
   validated replay settlement; retain compatibility for already-issued runs.
5. Migrate sector co-op and Iron Eclipse while preserving authentication,
   reconnect, AI command permissions, discovery and settlement boundaries.
6. Migrate Wing, private rooms and AI-fill through coordinated client/API/socket
   protocol changes. Keep ten-human competitive reward gates and no-reward
   private/AI-fill policy intact.
7. Connect all migrated operations to one Hangar → Universe → Briefing/Loadout →
   Deployment → Debrief → validated progression journey.
8. Retire legacy simulation paths only after callers, saved data, tests and
   rollback are accounted for.
9. Add fleet warfare, anomalies, independent asteroid operations, and new
   connected sectors through bounded, versioned operation/runtime adapters.

Each stage must have automated acceptance, documented evidence level, feature
gate and rollback. Production or a live reward setting is not changed by this
directive.
