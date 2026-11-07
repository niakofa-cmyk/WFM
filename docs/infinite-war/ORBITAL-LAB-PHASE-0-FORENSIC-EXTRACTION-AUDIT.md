# Orbital Lab Phase 0 forensic extraction audit

## Scope and evidence boundary

This is a source-level audit of the current workspace checkout, not a claim about
the latest remote `staging` branch or a deployed build. The checked-out branch is
`design/orbital-universe-entry` at `7ee12c9`; the worktree also contains the
uncommitted local streamed-sector implementation. The attached direction
document's branch, commit, and pull-request statements are preserved as
user-provided source, but were not independently verified against GitHub.

The audit maps the Orbital Lab boot, runtime, simulation, rendering, controls,
session lifecycle, current mode launch paths, authority boundaries, and migration
gaps. It does not claim authenticated staging, Production, or physical-device
verification.

## Executive finding

Orbital already has useful canonical simulation and presentation capabilities,
but it is not yet the single game boot/runtime through which all WFM modes are
experienced. The offline Lab remains a separate `combat-lab.html` React entry.
The account game still has its own `WarApp` shell and route state; Rust Disc,
co-op, Iron Eclipse, campaign, competitive Wing, and Galaxy services retain
distinct operation and authority paths.

The local Orbital universe's no-reward rule is limited to that offline sandbox.
The target authenticated universe is reward-capable and server-authoritative;
see the [dynamic encounter and exploration direction](DYNAMIC-FACTION-ENCOUNTERS-AND-EXPLORATION-AUTHORITY.md).

The correct rebuild is therefore not “add more universe scenery beside the
Lab.” It is to turn the Orbital foundation into the primary game entry and
runtime, then migrate each mode through an explicit adapter while preserving its
existing multiplayer, mission, account, and reward authority until parity and
rollback are proven.

## Orbital Lab boot and runtime lifecycle

| Stage | Current owner | Source-level behavior |
| --- | --- | --- |
| Entry | `src/combat-lab.tsx` | Creates a separate React root, query client, and error boundary. URL query state can enter a local universe directly; otherwise it shows a faction/ship/destination selection screen. |
| Launch selection | `CombatLab` | Selects standalone combat practice, the local universe, or the local Cinder approach. Arena and approach components are lazy-loaded. |
| Runtime contract | `Arena` + `@workspace/orbital-sim` | Resolves a `GameModeDefinition`, checks its declared runtime, creates an Orbital runtime session when applicable, and rejects online Orbital sessions until their authority is negotiated. |
| Match/session setup | `Arena`, `sim.ts`, `orbital-universe-session.ts` | Creates the combat match and input state. Local universe sessions separately own exploration/dock/training/debrief state and the local sector address. |
| Renderer | `Arena` + Three.js | `useLayoutEffect` creates the WebGL renderer, scene, environment, ship visuals, camera, HUD/radar drawing resources, and optional local streamed-sector scenery. `Arena` is the lifecycle owner. |
| Input and controls | `input.ts`, `PilotFlightStick`, `PilotActionButton`, shared Orbital pilot controls | A single input bus normalizes keyboard, touch sticks, throttle, and buttons. Movement values are translated at the simulation boundary. |
| Simulation loop | `Arena` | One animation-frame loop caps elapsed time and advances fixed simulation ticks. Local universe exploration runs pilot-only spatial flight; offline match combat and online legacy rooms run other match-step paths; online results are reconciled from server snapshots. |
| Network authority | `Arena` for Wing client; server socket and API for online modes | Online mode owns a WebSocket lifecycle, sequenced input, snapshots, reconnect handling, and replay traces. Local Orbital universe launch explicitly throws if it attempts to open a network session. |
| Teardown | `Arena` effects | Cancels animation work, removes listeners, closes owned sockets, disposes Three.js resources, and clears transient input/render state. |
| Result and return | `WarApp` or standalone `CombatLab` | Local Lab results return to local setup without account settlement. Campaign/competitive outcomes follow their server contracts; they are not authorized by local Lab success. |

### Lab capability inventory

The Orbital Lab path currently contains:

- Six-axis spatial flight and shared pilot-control normalization.
- A fixed-step simulation foundation with versioned Orbital runtime/rules IDs.
- Target acquisition, lock progress, gun/projectile and missile mechanics,
  countermeasures, hull/armor/shield damage, ship abilities, and local AI combat.
- Three.js ship/environment rendering, camera behavior, telemetry, radar/HUD,
  audio, damage/weapon effects, and mobile touch controls.
- Offline practice match lifecycle and an Arena-owned local universe session
  with Cinder approach/dock, station training, debrief/return, deterministic
  streamed local sectors, and non-reward anomaly scans.
- Unit/integration coverage for simulation rules, controls, runtime gates,
  docking, sector-coordinate rebasing, generated sector content, and combat
  ownership.

This inventory describes code capabilities; it does not certify equal
performance, visual quality, or behavior across every device and mode.

## Dependency and ownership map

| Responsibility | Current source | What it owns | Rebuild implication |
| --- | --- | --- | --- |
| Orbital bootstrap contract | `lib/orbital-sim/src/game-mode.ts`, `runtime.ts` | Mode metadata, runtime/rules versions, and a launch-time compatibility guard | Extend into a complete authoritative mode contract; current metadata alone does not prove that the actual route uses the declared renderer, mission rules, or authority. |
| Shared simulation package | `lib/orbital-sim/src/` | Spatial flight, deterministic math, weapons, controls, runtime IDs, replay/combat outcomes, and sector-flight contracts | Keep as the canonical simulation foundation; migrate and version real callers rather than treating shared imports as proof of complete mode migration. |
| Arena simulation adapter | `src/game/sim.ts`, `orbital-sim.ts`, `orbital-flight.ts` | Match state, objective progression, and connection to Orbital simulation rules | Separate generic engine mechanics from Arena/mode-specific objectives and training flow. |
| Arena renderer/orchestration | `src/game/Arena.tsx` | Three.js renderer lifecycle, camera, scene, HUD, input bus, audio/effects, local AI/match stepping, online prediction/snapshot handling, universe transitions | Major extraction target: split renderer, simulation adapter, input, network authority, HUD, and lifecycle ownership into explicit subsystems. |
| Local universe state | `orbital-universe-session.ts`, `orbital-universe-runtime.ts`, `universe-sectors.ts`, `universe-sector-visuals.ts` | Offline navigation/session phases, local coordinates, generated scenery/colliders, anomaly scan eligibility | Keep strictly local until a versioned server location/discovery contract exists. Do not use these values as persistent or multiplayer authority. |
| Rust Disc presentation and mission adapter | `RustDiscFlight.tsx`, `three-flight-runtime.ts`, `flight-sector.ts` | Dedicated Rust Disc scene/lifecycle, controls, local mission objectives, and sector protocol adapter | Preserve as rollback until presentation and mission/objective parity move successfully; shared movement rules alone are not wholesale migration. |
| Co-op operation | `SectorExpedition.tsx`, API-server sector runtime/socket, shared sector contracts | Authenticated rooms, server snapshots, objectives, AI/subsystems, completion and settlement | Retain server ownership; migrate client presentation and protocol together with replay/reconnect proof. |
| Account world and destination directory | `GalaxyScreen.tsx`, world routes and operation network | Account-backed locations, travel, discoveries, service/event listings, and server-validated admission | Become the strategic authority behind the unified in-universe navigation; the local Arena sector address is not a replacement. |

## Current mode-by-mode execution matrix

“Orbital runtime” below means the simulation/runtime declared or selected in
source. It does not automatically mean a mode has migrated its presentation,
mission logic, network protocol, or authority.

| Mode | Actual entry/launch | Simulation/runtime evidence | Renderer/lifecycle | Authority and current migration status |
| --- | --- | --- | --- | --- |
| Offline Orbital Combat Lab | Standalone `combat-lab.html`; `CombatLab` launches `Arena` | `orbital-combat-lab` declares canonical Orbital runtime and Arena | `arena-three-v1`, owned by `Arena` | Local no-reward practice. Separate entry; not yet the primary WFM boot. |
| Offline local universe | Standalone `combat-lab.html?universe=1`; also local-universe overlay in account `WarApp` | `orbital-universe-local`, Orbital runtime plus local-universe adapter | Same Arena renderer and lifecycle | Local only, no socket/location authority/reward. Its sector coordinates and scans are session state. |
| Rust Disc local flight | `/flight` → `RustDiscFlight` | `flight-sector.ts` adapter calls shared Orbital movement when configured with Orbital runtime | `rust-disc-three-v1`, owned by `RustDiscFlight` | Local/no reward. Movement reuse is partial migration; presentation, operation lifecycle, and mission objectives remain separate. |
| Rust Disc co-op sectors | `/expedition` → `SectorExpedition` → authenticated socket | Server sector simulation via versioned sector adapter; sector operation identity remains distinct | Rust Disc presentation/client lifecycle | Server-authoritative. Not equivalent to the offline Lab, and not yet an Orbital-owned end-to-end mode. |
| Iron Eclipse | `/expedition` with Iron Eclipse operation | Server sector operation adapter plus Iron Eclipse subsystem/objective logic | Rust Disc presentation/client lifecycle | Server-authoritative co-op operation; keep AI wing, subsystem damage, extraction, and validated outcome behavior. |
| Arcade / solo practice | Account `WarApp` → `Arena` | Declared canonical Orbital runtime | Arena Three.js lifecycle | Local/no rewards. Keep distinct mode configuration; verify objective behavior separately. |
| Campaign legacy sortie | Account `WarApp` server-issued run → `Arena` | Issued runs remain pinned to `surface-v1` when so configured | Arena renderer, legacy simulation selection | Server replay/settlement; cannot silently switch an existing run to a newer runtime. |
| Campaign Contact | Account `WarApp` server-issued run → `Arena` | Orbital runtime only when server config advertises it and replay supports it | Arena renderer | Server replay/settlement. Runtime rollout is versioned and must retain old runs. |
| Competitive Wing, private room, AI-fill | Account `WarApp` → `Arena` plus Wing socket | Current mode definitions select `surface-v1` compatibility simulation; Wing socket/server owns match snapshots and rules | Arena renderer/client lifecycle | Server-authoritative. Competitive ten-human eligibility, private/AI no-reward rules, reconnect, and ledger remain separate gates. Orbital online is rejected until negotiated. |
| Galaxy/universe navigation | `/universe` → account entry / `GalaxyScreen`; separate local Cinder approach component | `universe-navigation-v1`, navigation-only | Galaxy UI and local approach renderer | Server owns account travel and operation admission. This is not continuous shared 3D universe flight. |
| Fleet warfare | No launch path | Planned canonical Orbital contract | Not implemented | Not shipped. |

The current sector protocol includes explicit runtime-version mapping. The mode
registry labels co-op/Iron Eclipse as canonical `ORBITAL_RUNTIME_ID`, while the
negotiated server sector simulation contract uses `ORBITAL_WEAPON_RUNTIME_ID`.
The runtime test records this mismatch deliberately. Reconcile the mode metadata
with wire versions before declaring those modes migrated to the latest Orbital
rules.

## Critical gaps and extraction order

1. **Primary boot and journey:** move the game identity, hangar, universe and
   operation launch into one primary WFM boot. Keep standalone Lab and legacy
   entry routes as internal validation/rollback paths until acceptance passes.
2. **Explicit runtime adapters:** require each mode to declare and test its
   actual simulation package/version, renderer owner, mission/objective adapter,
   authority adapter, persistence, and reward eligibility at the real launch.
3. **Arena decomposition:** extract focused simulation, scene/render lifecycle,
   controls, network transport/reconciliation, local universe/session, HUD, and
   result/debrief services. Preserve the existing behavior while doing so.
4. **Rust Disc parity:** migrate mission state and the Rust Disc pilot/visual
   experience through a mode adapter, not just a movement-function import.
5. **Planetary theatre:** add real Mars-relative frames and tested atmosphere,
   surface, orbit, and departure transitions only after the foundation can own
   them without coordinate discontinuity.
6. **Multiplayer operations:** migrate co-op, Iron Eclipse, campaign, and Wing
   separately through coordinated client/server protocol versions; maintain
   server-owned damage/objectives/outcomes/rewards and rollback.
7. **Universe expansion:** add server-approved persistent destinations, shared
   presence, scheduled anomalies/events, and wider spatial destinations after
   mode authority and travel contracts exist.

### Phase 0 acceptance checklist

- [x] Identify current WFM, Combat Lab, and mode entry points.
- [x] Identify actual runtime, simulation package, renderer/lifecycle owner, and
  authority for each current/planned game mode.
- [x] Trace Orbital boot, simulation stepping, controls, rendering, network,
  cleanup, and local result lifecycle.
- [x] Record existing capabilities, reuse candidates, migration gaps, and
  authority risks without replacing working modes.
- [x] Add automated launch-contract tests that compare real route/runtime/
  renderer/authority wiring against this matrix.
- [ ] Reconcile the extracted matrix with authenticated staging and current
  server configuration before changing connected mode protocols.

Source-level inventory is complete for planning the first foundation change.
The last two checkboxes remain release/evidence work and must not be represented
as passing based solely on this document.
