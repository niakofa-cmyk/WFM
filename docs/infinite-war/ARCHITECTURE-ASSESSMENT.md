# Infinite War architecture assessment

## Current verified shape

The repository already shares one account identity, database schema, and
progression ledger across multiple features. It does **not** yet share one
combat or mission protocol across every feature. The main architectural risk is
therefore not a lack of modules; it is advancing one simulation or UI while
silently bypassing the existing authority and persistence contracts.

```mermaid
flowchart TD
  Player[Player / Clerk identity] --> App[React + Vite WFM app]
  App --> Hangar[WarApp / HomeScreen / Armory]
  App --> Local[Local Rust Disc and Combat Lab\nno account writes or rewards]
  App --> Campaign[Campaign / Strike client]
  App --> Wing[Authenticated Wing WebSocket]
  App --> Sector[Authenticated co-op sector WebSocket]
  App --> World[Authenticated world API]

  Campaign --> Progression[API progression and replay validation]
  Wing --> WingAuthority[Wing room, queue, and match authority]
  Sector --> SectorAuthority[XYZ flight, objectives, AI wing, and outcome]
  World --> WorldAuthority[Travel, discovery, contracts, market]

  Progression --> SharedDB[(Existing player and progression schema)]
  WingAuthority --> SharedDB
  SectorAuthority --> SharedDB
  WorldAuthority --> SharedDB

  CombatKernel[Shared deterministic orbital simulation] -. current client path .-> Local
  CombatKernel -. API replay/authority modules .-> Progression
  SectorAuthority -. separate XYZ flight contract .-> CombatKernel
```

The last dashed relationship marks an integration target, not a current
dependency: sector flight has its own `flight-sector.ts` state/input contract
and uses shared deterministic math primitives, but it is not yet the same
orbital combat protocol. The Wing socket room runtime also remains distinct;
the shared orbital package must not be described as an already integrated
ten-human 3D Wing simulation.

## Owner-directed connected-universe target

The current controlling direction is the connected-universe and Orbital
Operations Network foundation in
[`ORBITAL-OPERATIONS-NETWORK-FOUNDATION.md`](./ORBITAL-OPERATIONS-NETWORK-FOUNDATION.md).
Orbital Combat is the canonical orbital combat runtime; Rust Disc remains a
specialized flight-simulation experience connected through a versioned
operation adapter. The diagram above records current code boundaries only.

## Target architecture

Keep the current React/Vite and Three.js presentation, but make gameplay
contracts explicit and mode-versioned:

1. **Presentation layer:** one player journey, hangar, operations, world
   navigation, HUD, mobile input, rendering, effects, and audio. UI predicts and
   displays state; it does not authorize results.
2. **Versioned experience adapters:** Orbital Combat and specialist flight
   simulations expose consistent operation lifecycle and result contracts.
   Their physics and controls remain distinct where the game experience needs
   them to be.
3. **Existing authoritative services:** Clerk identity; Wing queue/session
   ownership; co-op sector runtime; campaign replay/claim validation; world and
   economy transactions; progression ledger. Integrate by adapters and staged
   protocol migration, not parallel auth, rooms, player tables, or reward stores.
4. **Validated operation result:** each networked mode emits a server-owned result with
   player/room scope, rules version, objectives, outcome, and idempotency key.
   Only explicitly eligible operations may call the existing settlement path.
5. **Universe state:** connected locations, travel, discoveries, and future
   strategic conflict state are server-derived. Do not persist territory or
   faction consequences until ownership, conflict resolution, and replay
   semantics are defined.

## Integration sequence and gates

1. **Inventory and contracts:** preserve the code-backed inventory and matrix.
   For every mode, record its runtime, authoritative inputs/snapshots/results,
   persistence calls, feature flags and rollback path.
2. **Operation contracts:** define shared location, operation, instance, event,
   assignment, presence, spectator, authorization, and result schemas without
   adding a second identity or persistence system.
3. **Specialist Rust Disc:** retain its flight-sector runtime behind an explicit
   compatibility adapter and connect the asteroid destination to the universe
   directory. Keep local training no-reward.
4. **Orbital parity:** pin deterministic traces across browser, API, socket, and
   replay before migrating other orbital modes.
5. **Campaign migration:** migrate every sortie through server-issued runtime
   versions and mission-specific objective adapters; preserve legacy replay for
   already-issued runs.
6. **Co-op migration:** adapt sector operations and Iron Eclipse while retaining
   authenticated room ownership, reconnection, server AI/objectives and
   idempotent discovery settlement.
7. **Competitive migration:** coordinate a new client/API/socket capability on
   staging. Require ten distinct authenticated humans, balanced teams,
   consistent authority, reconnect/interruption handling and existing reward
   ledger tests before reward-eligible orbital Wing is enabled.
8. **Universe networking:** connect operations to bounded instances, discovery,
   interest-managed event streaming, and read-only spectators only after actual
   server-owned sessions exist.
9. **Unified navigation and bounded expansion:** connect all migrated
   operations to the Hangar/Universe journey. Add persistent consequences and
   anomalies only as server-owned, deterministic, bounded mechanics.

## Non-negotiable boundary

The Combat Lab and local Rust Disc trainer stay offline/no-reward. A signed-in
profile, successful build, healthy deployment, local simulation, or two-pilot
private match is not proof of ten-player competitive 3D authority, reward
settlement, live event streaming, or Production readiness. Do not merge or
deploy a partial client/API/socket protocol.
