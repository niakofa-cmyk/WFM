# Infinite Universe and Orbital Runtime Direction

## Owner's leading source

The complete 958-line owner directive is preserved unchanged at
[`attached_assets/Pasted--WAR-FOR-MARS-INFINITE-WAR-MASTER-AI-DEVELOPMENT-DIRECT_1793833233901.txt`](../../attached_assets/Pasted--WAR-FOR-MARS-INFINITE-WAR-MASTER-AI-DEVELOPMENT-DIRECT_1793833233901.txt).
This document is its source-checked implementation companion. The governing
principle is **one game, one canonical 3D combat simulation, multiple operation
definitions, and a persistent connected universe**.

The Rust Disc flight behavior is the pilot-control reference; the Three.js
universe and sector co-op define the desired spatial scale and connected
destinations; `@workspace/orbital-sim` is the intended combat/flight foundation.
The hangar and universe are launch/navigation layers, not alternate simulation
engines. Offline sessions remain playable without a server; online identity,
room ownership, objective validation, and reward settlement stay with their
existing authoritative services.

## Current repository evidence and limitations

This audit covers the WFM source present in this workspace. The source repository
for any separate historical/open-universe Three.js build is not mounted here;
the owner's directive is a product and acceptance specification, not evidence
that the described old implementation is present or that its mechanisms have
already been extracted.

| Mode/system | Actual path in this checkout | Status and next migration proof |
|---|---|---|
| Orbital Combat Lab | `Arena` + `@workspace/orbital-sim`, local fixed-step combat; no reward settlement | Canonical training foundation. Continue as the executable harness. |
| Local Arena practice | `WarApp` → `Arena` → `orbital-v1` when no legacy server run is pinned | Canonical local entry. Must preserve no-reward behavior. |
| Rust Disc local flight | `RustDiscFlight`/Three.js rendering; `flight-sector.ts` owns mission, collisions, projectiles and objectives. `orbital-motion-v1` currently adapts movement only. | Partial migration, not full Orbital combat. Port weapons/objectives and prove the playable loop; retain the old path for rollback until then. |
| Rust Disc co-op / Mars Approach / Pale Beacons | Authenticated sector socket and `sector-motion-v1`; server validates movement, snapshots and objective lifecycle | Compatibility runtime. Migrate client, API, socket and mission state together; retain authority and reconnect behavior. |
| Iron Eclipse | Sector runtime plus server-owned squadron commands and capital-ship operation state | Compatibility runtime. Preserve command permissions, AI, subsystem gating, extraction and result idempotency. |
| Arcade Skirmish | `Arena` with `surface-v1` combat path | Compatibility runtime. Migrate objective-by-objective with no-reward local behavior. |
| Campaign Contact | `Arena` with `orbital-v1` for capable, pinned runs; server replay validates settlement | Canonical combat slice; keep existing issued-run compatibility. |
| Other campaign sorties | `Arena` with pinned `surface-v1` or configured runtime | Compatibility runtime. Preserve run IDs, objective replay, story state and idempotent claims. |
| Live Wing 5v5 / private / AI-fill | Authenticated Wing socket, matchmaking and `surface-v1` combat; Orbital Arena rejects live rooms | Not migrated. Keep competitive ten-human and reward gates; private and AI-fill remain no-reward. |
| Universe / Galaxy navigation | `GalaxyScreen`, world-operation directory and operation registration | Navigation and discovery only; not continuous 3D travel or shared flight. |
| Fleet warfare / persistent universe expansion | No complete runtime path yet | Planned. Do not count future scope as shipped. |

The current local Rust Disc scene shows Mars as a rendered body but also uses a
bounded training sector (the default radius is 460; Cinder Ring is 900). The
Orbital simulation can disable its local boundary, but a boundary-free local
coordinate does not by itself provide a planet reference frame, floating origin,
streamed systems, persistence or multiplayer universe. This checkout does not
yet prove continuous surface-to-orbit-to-interstellar travel. Never describe a
visual planet backdrop, large number, or sector transition as that proof.

## Shared mode contract and runtime bootstrap

`GameModeDefinition` now records each catalogued mode's mission, environment,
player and human minima, AI policy, objective IDs, rules, authority,
reward-eligibility policy, actual simulation ID, source packages and migration
status. `GAME_MODE_DEFINITIONS` is the source-backed mode inventory.

`createOrbitalRuntime` is the canonical bootstrap used by `Arena` for Orbital
launches. `Arena` requires an explicit `modeId` and checks that its declared
simulation matches the selected runtime. The bootstrap refuses partial,
compatibility, navigation-only and planned modes, so they cannot be labeled as
already migrated by selecting `orbital-v1`. This first contract/boot step does
not yet replace the separate Rust Disc or server sector operation wrappers.

Keep three authority patterns distinct:

- **Offline local:** uses the same pinned deterministic rules, no network
  dependency and no reward/progression writes.
- **Server replay/validation:** client simulation can be replayed, but the
  server decides whether a campaign outcome can settle.
- **Server-authoritative multiplayer:** the server owns accepted inputs, shared
  positions, combat/objective state, matchmaking and results. A browser runtime
  is not a substitute for this authority.

Historical issued runs may retain a pinned compatibility runtime until their
claims expire or are otherwise safely handled. That is replay compatibility, not
permission for new modes to silently choose a second combat engine.

## Rust Disc control behavior transferred to Orbital

The current Rust Disc mobile path maps left-thumb continuous input to yaw,
pitch, and coordinated bank; it combines right-thumb aiming, and maps same-edge
double-taps to short independent vertical or lateral thrust pulses. It does not
use ordinary stick drag as a second translation control. This meaning is now
shared by offline Orbital input:

- left stick: steer and pitch, with coordinated bank;
- right stick: aim;
- edge double-tap: brief vector thrust;
- keyboard: remains available;
- release, pause, focus loss and reset neutralize controls.

The online Wing mapping is unchanged. Landscape touch-target and simultaneous
multi-touch acceptance on physical Android/iOS devices remain unverified.

## Infinite-universe implementation architecture

“Infinite” means an extensible, persistent universe with no gameplay endpoint,
not an unbounded JavaScript `Number` coordinate or an infinitely loaded Three.js
scene. Implement it as:

1. Hierarchical stable IDs and coordinates: local craft frame → planetary frame
   → system frame → sector/system ID → universe address.
2. Double precision or integer/fixed-point high-level coordinates, with small
   local physics coordinates and floating-origin rebasing for rendering.
3. Explicit reference-frame conversion at planetary atmosphere, orbit, system
   travel and sector boundaries; transitions must not teleport or reset motion.
4. Deterministic seeded sector generation and distance/interest-based loading;
   persist discoveries and authored changes against stable location IDs.
5. Server-owned shared-sector membership, positions and events. Replicate only
   relevant nearby entities; do not simulate every universe object for every
   player.
6. Keep the same flight-control frame and versioned Orbital simulation through
   planetary, orbital and deep-space configurations. Environment/ship profiles
   may tune forces and handling without replacing the combat runtime.

## Ordered migration and proof gates

1. **Lock definitions and inventory:** keep the source-backed catalog and
   current mode-to-simulation table accurate; make launch mismatch fail closed.
2. **Control and deterministic flight:** compare identical input traces for
   Rust Disc and Orbital, including signs, bank, drift, pulses, throttle,
   velocity, orientation and camera; then compare physics and fixed-step traces.
3. **Finish local Rust Disc:** move combat, weapons and objective behavior into
   canonical Orbital adapters; verify relay → combat → extraction, no rewards,
   bounded collision safety and desktop/mobile layout before switching default.
4. **Migrate local Arcade and campaign:** preserve each mission's objective
   adapter, issued runtime, deterministic replay and validated settlement.
5. **Migrate co-op / Iron Eclipse:** coordinated client/API/socket versioning;
   preserve authenticated rooms, server movement, orders, reconnects, objectives
   and no duplicate reward or identity system.
6. **Migrate live Wing last:** coordinate its input protocol, simulation,
   matchmaking, sockets, reconnect, replay, participation and reward gates.
   Competitive play still requires ten humans; private and AI-fill stay
   no-reward. No live migration until staging parity and human-match evidence.
7. **Build planetary and extended universe:** prove sphere-relative Mars flight,
   altitude/atmosphere/orbit transitions, continuous departure and return,
   floating-origin precision, deterministic sector streaming and stable
   destination identity.
8. **Expand scale only after the slice:** stations, anomalies, fleets, extra
   systems and persistent faction conflict each receive bounded, deterministic,
   server-validated adapters.

No legacy path is deleted until all callers and issued data are accounted for,
parity/regression checks pass, and rollback is exercised.

## Evidence labels

Automated tests demonstrate code behavior only. A desktop screenshot does not
prove physical mobile input; a local two-client test does not prove carrier/WAN
performance; an offline session does not prove server authority; a runtime
definition does not prove every operation has migrated. Each release report
must separate automated, browser, staging, live-human and physical-device
evidence.
