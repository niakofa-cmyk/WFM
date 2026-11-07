# WFM main-engine architecture

## Controlling direction

The owner's latest [Orbital universe rebuild contract](../ORBITAL-UNIVERSE-REBUILD-CONTRACT.md)
clarifies the execution boundary: build the playable Infinite War universe
inside the Orbital runtime, replacing its role as merely an optional training
link. Training becomes a mode within that game. Extract the Lab/Arena/approach
lifecycle responsibilities into the main runtime rather than putting another
universe application around them. Existing shared imports, charts and account
links do not demonstrate this migration; the actual-architecture section below
still describes separate lifecycle owners.

The complete source is retained unchanged at
[`../../../attached_assets/Pasted--MASTER-DEVELOPMENT-DIRECTIVE-WAR-FOR-MARS-INFINITE-WAR_1793996096249.txt`](../../../attached_assets/Pasted--MASTER-DEVELOPMENT-DIRECTIVE-WAR-FOR-MARS-INFINITE-WAR_1793996096249.txt).
This directive supersedes older descriptions of permanently independent engine
foundations. The target is **one Orbital main engine, distinct gameplay
configurations and authority adapters, one connected universe**. Distinct
experiences need not share identical physics parameters or objectives.

Section 16 requires engine consolidation before appearance redesign. Existing
Rust Disc, Wing, account records, issued replays and multiplayer safeguards stay
operational until replacement paths pass compatibility and rollback gates.
The owner has since clarified that Three.js is not part of the final runtime:
Orbital Engine must own rendering and gameplay. Three.js is reference material
for techniques only. The repository's current Three.js renderer is a temporary
implementation until Orbital's replacement passes the
[renderer migration gates](../ORBITAL-ENGINE-ONLY-RENDERER-REBUILD.md).

## Actual architecture, source audited 2026-11-06

```text
Touch / keyboard / controller device handling
                 |
@workspace/orbital-sim / pilot-controls
  bounded intent + explicit pilot-axis and sector-protocol adapters
                 |
  game-mode contract + versioned runtime bootstrap
                 |
  flight / deterministic math / weapons / sector operation adapter
                 |
  local execution | campaign replay | sector server | Wing compatibility
                 |
  Arena / RustDiscFlight presentation, camera, HUD, effects
                 |
  existing identity, operation directory, world, progression, reward services
```

- Shared flight, weapons, deterministic math, mode contracts and runtime IDs
  exist in `lib/orbital-sim/src/`.
- Pilot intent normalization and adapters now live in that same library.
  `artifacts/war-for-mars/src/game/flight-control.ts` is only a compatibility
  re-export. Arena and the sector adapter share pilot-axis conversion.
- `Arena` and `RustDiscFlight` still own separate Three.js lifecycles.
- `@workspace/orbital-sim` is a simulation/rules package, not a complete
  Orbital-native renderer; the final architecture is not implemented yet.
- Client/API `orbital-sim.ts` and `orbital-abilities.ts` remain separate
  orchestration implementations. Shared primitives do not prove the entire
  combat loop has been consolidated.
- Live Wing still selects `surface-v1`. The Orbital authority harness is not
  proof of a migrated public ten-human service.
- Persistent navigation and destination counts exist; continuous shared free
  flight, region streaming and a fleet encounter director are not established.

## Audit coverage and limits

72 retained Markdown/text documents and the four recent universe briefs were
screened for requirements and conflicts; the new 799-line directive was read
in full. Current mode definitions, launch owners, shared flight/input code,
sector dispatch and major presentation paths were inspected directly.
The archive contains 285 indexed files; its `src/game/sim.ts` is a historical
candidate, not behaviorally certified. Remote branch names were inventoried,
but every historical branch was not executed or device-tested. No separate
Ironcliff/Ironcliffe implementation was found in the current source search;
do not attribute Iron Eclipse capabilities to an unlocated build.

Latest remote `staging` source was fetched. The working branch
`integration/master-engine-consolidation` starts there and retains the existing
integration branch through a merge. That includes earlier integration work
which still needs its own release evidence; fetching staging is not verification
of a deployed staging revision. No main/staging push or deployment is authorized
by this document.

## Architecture set

1. [Feature extraction](FEATURE-EXTRACTION-MATRIX.md)
2. [Flight physics](FLIGHT-PHYSICS-AND-CONTROLS.md)
3. [Mobile controls](MOBILE-CONTROL-SPECIFICATION.md)
4. [Combat](COMBAT-SYSTEM-ARCHITECTURE.md)
5. [Universe](UNIFIED-UNIVERSE-ARCHITECTURE.md)
6. [Multiplayer](MULTIPLAYER-OPERATION-ARCHITECTURE.md)
7. [Mode migration](GAME-MODE-MIGRATION-MATRIX.md)
8. [Performance and devices](PERFORMANCE-AND-DEVICE-VALIDATION.md)
9. [Regression and delivery evidence](ENGINE-REGRESSION-REPORT.md)

## Ordered acceptance gates

1. Finish source inventory and parity fixtures; never infer features from prose.
2. Consolidate shared input/flight/combat modules without altering old replays.
3. Prove one ship's flight, combat and mission in the consolidated runtime,
   then a distinct arcade configuration using the same modules.
4. Migrate operation presentation, objectives and server adapters separately.
5. Certify an authenticated Orbital asteroid operation and sanitized observer
   state before extending the universe or presenting it as live multiplayer.
