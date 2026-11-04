# WAR FOR MARS: THE INFINITE WAR — canonical orbital runtime

## Owner reference

The complete owner-provided directive is preserved unchanged at
[`../../attached_assets/Pasted--WAR-FOR-MARS-THE-INFINITE-WAR-MASTER-ORBITAL-ENGINE-CO_1793798261341.txt`](../../attached_assets/Pasted--WAR-FOR-MARS-THE-INFINITE-WAR-MASTER-ORBITAL-ENGINE-CO_1793798261341.txt).
It is the controlling product direction for the full-game runtime migration.

## Direction update — one universe, compatible specialist runtimes

The latest owner clarification and its full implementation direction are
preserved in
[`ORBITAL-OPERATIONS-NETWORK-FOUNDATION.md`](./ORBITAL-OPERATIONS-NETWORK-FOUNDATION.md)
and take precedence where they refine the earlier single-runtime wording below.
WFM is one connected universe with multiple independently operating
experiences. Orbital Combat remains the canonical runtime for orbital combat.
Rust Disc's established flight-sector experience remains a specialist runtime
behind an explicit operation adapter; do not force its controls or physics into
Orbital Combat solely to claim one engine.

**One connected universe. Multiple game experiences. One trusted operation
network.**

Experiences share account identity, universe locations, operation lifecycle,
and existing authoritative services—not necessarily identical flight physics.
Clerk identity, room ownership, matchmaking, mission adjudication, world state,
loadouts, progression, rewards and idempotency remain owned by their existing
services. Orbital Combat Lab and local specialist training remain no-reward.

## Migration contract

1. The `lib/orbital-sim` package owns the canonical deterministic orbital
   combat rules. Specialist runtimes retain their own versioned rules behind
   operation adapters.
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
| Offline `WarApp` Arena practice | `orbital-v1`; server-issued legacy runs remain pinned to their original runtime | Extend this first offline migration to all local mission content |
| Rust Disc local flight | `flight-sector.ts` specialist simulation with a separate renderer | Retain behind a versioned operation adapter; consolidate shared infrastructure without erasing its flight identity |
| Sector Expedition / Iron Eclipse | Authenticated sector socket and a separate sector flight contract | Adapt the server-owned sector runtime and objectives to canonical orbital state |
| Arcade Skirmish and most campaign sorties | `Arena` legacy surface runtime | Migrate every mission configuration and preserve its objective/result semantics |
| Campaign Contact | Versioned `orbital-v1` server replay for capable clients; older/issued runs remain surface | Preserve compatibility while expanding validated orbital mission coverage |
| Online Wing / private / AI-fill | Existing authenticated socket and matchmaking; orbital `Arena` currently rejects live rooms | Coordinate client, API and socket protocol migration; retain all room/reward safeguards |
| Hangar, Galaxy, Market, account progression | Existing account- and server-backed services | Feed their saved configuration and validated outcomes into the shared operation lifecycle |

The code above is a partial foundation, not a completed consolidation. In
particular, a runtime identifier or an orbital renderer is not proof that a mode
has migrated.

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
3. Connect local Rust Disc to the universe lifecycle and retain its specialist
   runtime; migrate Arcade and orbital local training to the canonical engine,
   keeping them no-reward.
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
