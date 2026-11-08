# Mode-by-mode migration proof

Source registry: `lib/orbital-sim/src/game-mode.ts`; actual calls and protocol
contracts take precedence over a registry's `canonical` label. Simulation,
presentation, authority and device evidence are separate gates.

| Experience | Actual simulation / entry | Presentation owner | Authority | Remaining main-engine gate |
|---|---|---|---|---|
| Orbital Combat Lab | `orbital-v5`; `Arena` → Orbital step | Arena | Local/no reward | Extract duplicated orchestration and certify device controls |
| Local Arena / Solo Flight | Canonical Orbital config through Arena | Arena | Local/no reward | Distinct arcade objective parity using same core |
| Arcade Skirmish | Current offline Orbital selection in `arena-config.ts` | Arena | Local/no reward | Full launch/objective/debrief evidence, not reward promotion |
| Rust Disc local | `stepSectorFlight` → shared spatial integrator | RustDiscFlight | Local/no reward | Input-feel/camera/presentation/mission parity; preserve original entry |
| Rust Disc co-op | Sector server adapter; shared Orbital movement; protocol-specific contract | RustDiscFlight | Server | Reconcile declared/executed version and complete paired acceptance |
| Mars Approach / Pale Beacons | `sector-missions.ts` via sector runtime | RustDiscFlight | Server | Explicit per-mission parity and shared-world transition design |
| Iron Eclipse | Sector runtime plus capital/order mechanics | RustDiscFlight | Server | Preserve subsystem/orders/extraction; consolidate presentation adapter |
| Contact campaign | Orbital for capable newly issued runs; pinned legacy fallback | Arena | Server replay | Authenticated staging claims/interruption/device evidence |
| Other / old campaign runs | `surface-v1` or original issued runtime | Arena | Server replay | Migrate one sortie contract; never reinterpret old runs |
| Wing competitive | Live `surface-v1` simulation/socket | Arena | Server | Gated Orbital network migration and ten-human certification |
| Wing private / AI-fill | Existing surface room rules | Arena | Server/no reward | Control/reconnect parity; preserve no-reward and privacy rules |
| Universe navigation | World API + local Orbital docking | GalaxyScreen / local approach | Server world; local approach | Main-engine environment/streaming, not another universe app |
| Fleet warfare / anomalies | Planned | Not implemented as full operations | Future server | Define bounded/versioned behaviors before launch |

## Order and retirement conditions

1. Shared input/flight/combat foundation and compatibility fixtures.
2. Local Rust Disc, Lab, Solo and Arcade configurations and presentation.
3. Campaign objectives and preserved replay settlement.
4. Mars route / cooperative sectors / Iron Eclipse authority adapters.
5. Wing's coordinated networking and competitive certification.
6. Unified universe runtime/streaming, anomalies and fleet encounters.

The directive's phases can overlap for supporting infrastructure, but no mode
is called end-to-end migrated until launch, engine dispatch, controls, rendering,
objective/result, authority, persistence and rollback are all proven.
No existing mode is removed or relabeled as fully migrated in this slice.
