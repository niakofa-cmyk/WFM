# Master engine feature extraction and migration status

## Owner reference

The complete, owner-supplied direction is retained unchanged in
`attached_assets/Pasted--MASTER-DEVELOPMENT-DIRECTIVE-WAR-FOR-MARS-INFINITE-WAR_1793819815572.txt`.
This code-grounded audit is its implementation companion. The directive sets
Orbital Combat Lab as the eventual shared gameplay engine; it does not authorize
an untested rewrite or removal of existing operation safeguards.

## Verified source inventory

| Source / capability | Evidence in the current source | Current status | Consolidation destination |
|---|---|---|---|
| Orbital Combat Lab | `lib/orbital-sim/src/flight.ts`, `weapons.ts`, and `artifacts/war-for-mars/src/game/orbital-sim.ts` | Deterministic 6DoF combat, weapons, target acquisition, damage, and offline training exist. It is not yet the runtime for every mode or live Wing. | Canonical, versioned simulation; keep the trainer no-reward. |
| Orbital movement | `integrateSpatialFlight` | Pitch/yaw/roll, forward/strafe/vertical thrust, momentum, braking, boost, and inertial assist exist. Vector-drift braking behavior was not previously exposed as the Rust Disc hold control. | Shared flight-control frame and ship tuning, while retaining simulation version boundaries. |
| Rust Disc local flight | `artifacts/war-for-mars/src/game/flight-sector.ts` and `RustDiscFlight.tsx` | Versioned sector movement, quaternion rotation, forward thrust, drift, collision, lock, guns, missiles, countermeasures, extraction, and a separate Three.js scene exist. The former touch UI lacked lateral and vertical thrust. | Migrate validated movement, control, and environment capabilities into canonical orbital configurations; retain the existing experience as a rollback path until acceptance passes. |
| Rust Disc / sector socket | `artifacts/api-server/src/socket/sector-runtime.ts` and `sector-runtime.ts` | Server validates bounded flight inputs and owns room snapshots, mission phases, and operation state. Its sector simulation source is mirrored in the client and tested for parity. | Versioned runtime adapter; migrate client, API, and socket together. Do not move authority into the browser. |
| Iron Eclipse | `artifacts/api-server/src/game/iron-eclipse.ts` and the sector socket runtime | Server-owned squadron movement, four tactical orders, capital subsystems, point-defense behavior, damage, and extraction are implemented on the sector runtime. | Preserve its operation/objective and permissions while porting movement/combat to the canonical engine behind a versioned adapter. |
| Mobile flight controls | `artifacts/war-for-mars/src/game/input.ts`, `RustDiscFlight.tsx`, and `mobile-controls.test.ts` | Orbital/Arcade use a control bus; Rust Disc used a separate direct touch-input shape. Keyboard, touch, dead-zone, and optional gyro support are present in parts of the game, not yet one configurable mobile framework. | `FlightControlFrame` is the shared input intent. Per-runtime adapters preserve distinct physics and supported actions. Device layout, gyro, and real-phone acceptance remain separate work. |
| Campaign and Arcade | `artifacts/api-server/src/game/progression.ts`, `rewards.ts`, and `artifacts/war-for-mars/src/game/Arena.tsx` | Contact can use pinned `orbital-v1` replay for capable clients. Other sorties and most Arcade routes still use `surface-v1`; server replay and claims remain authoritative. | Migrate one mission definition at a time; preserve issued-run runtime IDs, objective replay, and claim idempotency. |
| Online Wing | `artifacts/api-server/src/socket` and the Wing combat/queue modules | Authenticated matchmaking, room ownership, participation, and reward safeguards exist on the current Wing contract. Orbital `Arena` does not accept live rooms; 10-human orbital combat is not established. | Coordinated, versioned client/API/socket migration; keep private and AI-fill no-reward and keep competitive rewards server-owned. |
| Universe and operation network | `operation-network.ts`, world-operation routes, Galaxy, and Cinder Ring hub | Destination/operation discovery and sanitized activity contracts exist. They do not make a directory entry into a shared 3D session. | Keep navigation and operation lifecycle connected; launch each migrated operation in its actual configured engine. |

## Implemented consolidation slice

This revision adds a mode-neutral `FlightControlFrame` and adapters for Orbital
and sector flight. Rust Disc now has a mobile vector stick for lateral and
vertical thrust, and the sector simulation applies those axes in ship-local
space. The sector socket accepts the axes as optional input fields, so older
clients remain neutral on them. The same deterministic sector-simulation source
is updated in the client and server.

The canonical orbital simulator now supports held vector drift, and the mobile
Orbital controls distinguish that action from the separate inertial-assist
toggle. This transfers a verified Rust Disc handling capability without
pretending that all sector movement, objectives, AI, or multiplayer have already
migrated.

## Migration classifications

- **PRESERVE:** deterministic orbital flight/combat package, server-owned
  operation outcomes, existing campaign claims, Wing identity/matchmaking and
  reward safeguards, and Iron Eclipse objective/order permissions.
- **EXTRACT / ENHANCE:** normalized flight controls, vector drift, six-axis
  translation, flight tuning, weapon/lock feedback, and mobile control behavior.
- **ADAPT:** sector rooms, Iron Eclipse, campaign runs, and Wing through pinned
  runtime/operation contracts while moving their actual gameplay to Orbital.
- **RETIRE only after proof:** duplicate physics, control pipelines, and old
  runtime paths after callers, saved runs, parity tests, and rollback are
  accounted for.
- **NOT VERIFIED:** complete mobile control customization, gyroscope parity in
  every mode, every campaign/Arcade operation on orbital-v1, orbital Iron
  Eclipse, and live 10-human orbital Wing.

## Ordered acceptance gates

1. Keep client/server sector source parity, validate both new axes, and prove
   omitted axes remain neutral for older clients.
2. Prove six-axis controls, vector drift, brake precedence, determinism, and
   bounded input in both simulation tests.
3. Move Rust Disc local missions to canonical orbital state through an explicit
   sector/objective adapter; verify its current entry still works until the
   migration gate passes.
4. Adapt Iron Eclipse movement and capital systems to the canonical runtime;
   retain server-owned orders, subsystem gating, extraction, and idempotent
   result handling.
5. Migrate each campaign and Arcade operation with pinned runtime versions,
   deterministic replay, and existing validated settlement.
6. Migrate Wing only through coordinated client/API/socket changes, then verify
   authentication, team assignment, reconnect, server-owned combat, and
   reward-gate behavior before staging human trials.
7. Profile the consolidated slice on supported Android hardware. A successful
   typecheck, unit test, or desktop preview is not mobile performance evidence.
8. Retire legacy implementations only after all callers and stored runs are
   covered by parity, migration, rollback, and release checks.

No Production deployment, reward switch, database schema, authentication flow,
or Railway resource is changed by this document or the control migration.
