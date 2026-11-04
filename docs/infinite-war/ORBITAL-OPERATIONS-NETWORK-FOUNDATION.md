# WAR FOR MARS: INFINITE WAR — Orbital Operations Network foundation

**Current owner direction:** one connected multiplayer universe, with multiple
independent experiences and versioned simulation adapters. The universe is the
battlefield; operations are real locations and sessions, not disconnected menu
commands.

**Owner source:** the full directive is preserved unchanged at
[`../../attached_assets/Pasted--MASTER-DEVELOPMENT-DIRECTIVE-WAR-FOR-MARS-INFINITE-WAR_1793803481556.txt`](../../attached_assets/Pasted--MASTER-DEVELOPMENT-DIRECTIVE-WAR-FOR-MARS-INFINITE-WAR_1793803481556.txt).

## A. Current architecture audit

This is a source-backed audit of the current repository, not a claim about
Railway staging or Production:

| System | Current implementation | Evidence boundary |
|---|---|---|
| Orbital Combat Lab | Offline browser training using the shared `orbital-v1` simulation | No rewards; does not establish live operation authority |
| Rust Disc local flight | `flight-sector-v1` flight sector and Three.js renderer | Remains a separate no-reward specialist runtime |
| Rust Disc co-op / Iron Eclipse | Authenticated socket server owns pilot snapshots, mission phase, commands, and existing discovery settlement | Uses its current sector runtime; no OON instance orchestration yet |
| Campaign | Existing strike-run and replay/claim authority; Contact has an orbital path and older runs retain pinned behavior | Most missions are not fully migrated |
| Wing | Existing authenticated queue/room socket and reward safeguards | Not an orbital OON instance; no ten-human orbital proof |
| Galaxy | Existing player-scoped world state, travel, exploration, contracts, economy, and progression records | Strategic travel is not yet seamless spatial flight between sectors |
| OON catalog | New public, validated `GET /api/world/operations` contract | Catalog-only; empty live instance and event arrays |
| Cinder Ring | New server-defined asteroid destination reachable from Rust Disc in the existing world map | Navigation is strategic route travel; the asteroid flight is a separate local runtime, not a live multiplayer arena |

No new identity provider, player table, reward ledger, database, cache, or
multiplayer service is introduced by this slice.

## B. Multiplayer universe architecture

```text
Clerk identity ── existing profile / auth services ──────────────────────┐
                                                                         │
Galaxy world API ── location + route state ── OON directory             │
                                              │                          │
                                              ├── OperationDefinition   │
                                              ├── UniverseLocation      │
                                              ├── OperationInstance     │
                                              └── UniverseEvent         │
                                                                         │
Operation admission ── existing or future authoritative coordinator ────┤
       ├── MatchAssignment / JoinAuthorization                           │
       ├── versioned runtime adapter (Orbital | Rust Disc specialist)     │
       ├── optional read-only SpectatorSession / safe presence stream    │
       └── server-validated OperationResult ── existing progression      │
                                               / reward authority ────────┘
```

An empty directory instance list means no live session is advertised. Directory
catalog definitions are not participants, match assignments, or proof of live
combat. When sessions are implemented, each instance will be backed by a
server-owned lifecycle and the existing authentication/room systems. Public
presence must contain only opted-in callsigns and observer-safe state.

### Shared operation contract

The OpenAPI contract defines:

- `OperationDefinition`: immutable mode identity, location, experience, runtime
  and ruleset versions, capacity, visibility, lifecycle, access, and reward
  authority.
- `OperationInstance`: a real server-owned session, actual phase and occupancy,
  and pinned runtime/ruleset.
- `UniverseLocation`: a physical 3D sector coordinate linked to the persistent
  world-location identifier.
- `UniverseEvent`: a server-confirmed event tied to a location and, when
  applicable, a real operation instance.
- `PlayerPresence`: callsign/team/position only; no account ID or private
  identity is exposed.
- `MatchAssignment`: server-issued instance seat and pinned runtime.
- `SpectatorSession`: explicitly read-only session and allowed camera modes.
- `JoinAuthorization`: explicit allow/deny result and optional assignment.
- `OperationResult`: server-verified runtime, ruleset, objectives, and outcome.

The current directory uses definitions and locations. It returns no instances
or events because there is no operation coordinator publishing those yet.

## C. Migration matrix

| Experience | Runtime / authority now | Connected-universe destination | Required acceptance |
|---|---|---|---|
| Orbital Combat Lab | `orbital-v1`, local only | Canonical orbital training and combat foundation | Repeatable deterministic scenario; no settlement |
| Rust Disc local | `flight-sector-v1`, local only | Cinder Ring specialist asteroid operation | Stable 3D controls, explicit adapter, no account writes |
| Rust Disc co-op | Existing authenticated sector socket | Rust Disc / Mars / Pale Beacons server operation | Authenticated multi-pilot parity, reconnect, server objectives |
| Iron Eclipse | Existing co-op runtime and subsystem authority | Major cooperative operation | Host commands, subsystem state, extraction, idempotent result |
| Arcade | Existing legacy surface routes | Orbital-runtime operation definitions | One mode at a time; preserve objectives, replay and rollback |
| Campaign / Strike | Existing authenticated run and claim flow | Narrative operations with pinned runtime version | Every sortie preserves replay/claim safeguards and objectives |
| 5v5 Wing | Existing authenticated queue/socket/rewards | Competitive OON warfront; orbital migration later | Ten distinct humans, team balance, reconnect, authority, ledger gates |
| Universe / Galaxy | Persistent player-scoped world API | Location discovery, travel, operation directory | Existing transaction/idempotency checks remain authoritative |
| Spectating / live events | Not implemented | Read-only interest-managed event stream | Actual active server instance, privacy review, no control or tactical leak |
| Additional asteroid/fleet events | Not implemented | Independent bounded operation instances | Capacity, tick, bandwidth, mobile and reconnect measurements |

## D. Prioritized implementation backlog

1. **Foundation (this slice):** operation schemas, public directory, Cinder Ring
   route, local specialist runtime adapter, and truthful empty live-session state.
2. **Rust Disc stage A:** audit local and co-op separately; decide adapter
   ownership and map mission/run lifecycle without replacing the working
   specialist flight.
3. **Orbital operation adapters:** wrap Combat Lab and orbital campaign/Arcade
   missions in the same operation lifecycle; pin runtime and rules versions.
4. **Campaign and co-op:** migrate mission-by-mission while preserving claims,
   reconnection, objectives, and the no-reward Rust Disc discovery policy.
5. **Competitive Wing:** coordinate client/API/socket runtime contract and only
   retain competitive rewards after existing ten-human staging gates pass.
6. **Instances and live observers:** implement bounded orchestration, safe
   presence, interest management and read-only spectators only against genuine
   server-owned sessions.
7. **Expansion:** concurrent asteroid matches, tournaments, fleet battles and
   anomalies after measured capacity/mobile performance evidence.

Every stage should be a small reviewable change with automated acceptance,
staging evidence where relevant, feature flags, and rollback.

## E. Risk and safeguard assessment

| Risk | Guard |
|---|---|
| Catalog appears to imply a live match | Instances/events are separate arrays; empty arrays are rendered as “no server-hosted instance” |
| Duplicate account or player systems | Reuse Clerk, existing profile, room, progression and reward services |
| Client fabricates presence, damage, or outcomes | Clients may render/predict; server owns networked movement, combat, objectives, assignments and results |
| Spectator advantage or privacy leakage | Read-only, allowlisted camera/state, no account IDs, private callsigns, controls or hidden tactics |
| Runtime migration breaks old runs | Pin runtime/ruleset on assignments and preserve legacy replay until compatibility gate passes |
| Local test results become rewards | Rust Disc local Cinder circuit is explicitly no-reward and sends no network session |
| Live 5v5 rewards enabled prematurely | Preserve existing eligibility, ten-human proof, transactional idempotency and release flags |
| Large shared simulation causes mobile lag | Bounded operations and interest-managed observer state; measure before expansion |
| Production changes during architecture work | No Railway resource, database, deployment, or Production changes are part of this implementation |

## F. First playable implementation

Implemented in this repository:

- A public typed operation directory endpoint, validated against generated
  OpenAPI/Zod response schemas.
- One linked physical 3D location record, Cinder Ring, and a player-travelable
  asteroid destination in the existing Galaxy route graph.
- One allowlisted local Rust Disc flight circuit at the asteroid using its
  specialist `flight-sector-v1` simulation and existing renderer.
- A Galaxy operation card that routes to the asteroid, launches the circuit
  when present, and clearly shows the directory's server-confirmed instance
  state.
- No instance or event is synthesized; no new rewards, profile writes,
  authentication, matchmaking, live combat, or spectator feature is claimed.

## Verification record

Fill in only after the current change's checks run. Local code/test/build
evidence is not staging or Production evidence.
