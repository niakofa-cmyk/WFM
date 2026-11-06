# Source extraction and integration matrix

See [controlling architecture](MASTER-ENGINE-ARCHITECTURE.md). Classifications
describe the next treatment, not completion. “Shared” is not “fully migrated.”

## Inventory: required dimensions 1–6

| Source | Existing feature / actual implementation | Condition | Dependencies | Existing controls | Physics / simulation |
|---|---|---|---|---|---|
| Orbital Lab | `Arena.tsx`, client `orbital-sim.ts`, library `flight.ts` / `weapons.ts` | Playable local training; no live Wing authority | Three.js presentation, ships, deterministic library | `input.ts`, `PilotFlightStick`, pilot gestures | Quaternion 6DoF, assisted damping, energy boost, bounded combat |
| Rust Disc local | `RustDiscFlight.tsx`, `flight-sector.ts`, shared `sector-flight.ts` | Playable operation with separate presentation | Sector geometry, shared flight/weapons, ship tuning | `TouchControls`, pilot frame, throttle, lock, missiles, countermeasures | Canonical movement adapter; relay/drone/extraction state machine |
| Sector co-op | `SectorExpedition.tsx`, API `socket/sector-runtime.ts` | Server-owned rooms; protocol rollout remains gated | Existing Clerk/socket/session/world services | Sanitized sector input; neutral/brake on interruption | Shared sector integration plus authoritative mission logic |
| Iron Eclipse | `iron-eclipse.ts`, sector missions and command parser | Capital subsystem/order operation within co-op | Same sector runtime and host permissions | Attack/defend/escort/regroup and subsystem targeting | Shared flight plus operation-specific state; not a separate infinite world |
| Route to Mars | `sector-missions.ts`, `sector-navigation.ts` | Rust Disc → Mars Approach → Pale Beacons route | Server prerequisites, discoveries and debrief | Sector pilot controls and navigation hint | Bounded mission worlds; Mars is physical sector geometry |
| Arcade / campaign | `WarApp.tsx`, `arena-config.ts`, API `progression.ts` | Local Arcade is Orbital; campaign depends on issued run | Existing run/replay and claim transaction | Arena input path and mode configuration | Contact supports Orbital; legacy-issued/other sorties retain surface rules |
| Wing | `socket/server.ts`, `game/wing.ts`, `sim.ts`, rewards | Existing live room/queue architecture; not Orbital flight | Authentication, seats, reconnect, reward ledger | Existing network-safe input mapping | Surface simulation; Orbital harness is separate evidence |
| Universe / docking | `GalaxyScreen.tsx`, `CinderRingDockingApproach.tsx`, `operation-network.ts` | Strategic world plus local docking and real directory | World DB, operation instances, SSE, expiring presence | Navigation UI; local flight approach | Docking uses shared spatial flight; directory is not a battle simulation |
| Historical sources | `.migration-backup/src/game/sim.ts`, remote branch inventory | Indexed, not behaviorally certified | Historical packages/configuration not assumed current | Not re-certified | No capability imported without direct review |

## Integration: required dimensions 7–12

| Source | Multiplayer compatibility | Performance evidence | Reusable components | Missing capability | Recommended improvement / class | Destination |
|---|---|---|---|---|---|---|
| Orbital Lab | Local plus replay/harness checks; no certified live Wing | Automated evidence only for this change | Flight, weapons, deterministic math, input | One rendering/combat orchestration owner | EXTRACT shared orchestration; ENHANCE tested capabilities | Main Orbital runtime |
| Rust Disc local | Local trainer distinct from co-op | Historical phone sample belongs only to that build | Controls, camera, objective and environmental behavior | Full input/presentation parity with Lab | EXTRACT verified behavior; ADAPT objectives/camera | Orbital operation adapter; retain original access |
| Sector co-op | Authenticated authority and versioned packets | No new on-device/network measurements | Sessions, mission states, reconnect, debrief | Unambiguous advertised/executed rules identity | PRESERVE authority; ADAPT version-pinned dispatch | Orbital server-operation adapter |
| Iron Eclipse | Same authoritative co-op rooms | Not newly profiled | Wing orders, capital subsystems, extraction | Consolidated presentation and complete parity proof | PRESERVE mechanics; ADAPT operation configuration | Capital-operation adapter |
| Route to Mars | Server-discovered route and prerequisites | No unlimited-distance evidence | Geometry, discoveries, mission sequence | Region streaming and shared continuous travel | EXTRACT routing; REBUILD streaming deliberately | Universe/operation framework |
| Arcade / campaign | Arcade no reward; campaign server replay | Tests do not prove phone performance | Mode configurations, pinned replays, objectives | All sortie contracts on canonical engine | ADAPT one objective/settlement contract at a time | Same core with different mode definitions |
| Wing | Existing live authority must remain intact | Two-phone private smoke report is not ten-human proof | Matchmaker, teams, seats, reconnect, rewards | Shared Orbital wire state and human certification | PRESERVE services; ADAPT through gated migration | Orbital competitive authority adapter |
| Universe / docking | Aggregates and sessions are distinct | No shared-flight scalability certification | Saved travel, locations, live directory, dock gate | Fleet encounters, anomalies, continuous streaming | ENHANCE main engine world integration; no separate app | Main-engine universe environment |
| Historical sources | Unknown until inspected | Unknown | Candidate mechanics only | Full dependency and behavior review | PRESERVE archive; RETIRE only after replacement proof | Extraction queue, never automatic production import |

No code is retired in this slice. The completed extraction is the common pilot
frame, normalization, protocol adapter and pilot-axis conversion. Legacy mode
specialization, unsupported reverse thrust and local-only maneuver restrictions
remain explicit rather than being silently “upgraded” through a network packet.
