# Engine consolidation regression report

## Scope

2026-11-06 engine-first extraction under the latest master directive.
No appearance redesign, simulation-rule release, wire-protocol upgrade,
database migration, authentication change, reward enablement or deployment.

## Implemented slice

- Engine-owned pilot frame, neutral state and normalization.
- Engine-owned Orbital/sector input adapters, preserving existing behavior.
- Shared Rust Disc pilot-axis conversion used by sector flight and Arena input.
- Browser import compatibility path retained; old callers need no migration.
- Regression checks prevent a second browser implementation and compare
  canonical sector/Orbital trajectories at identical tuning and scale.

## Evidence

| Check | Observed result |
|---|---|
| Focused control/sector/mode/replay suite | 54/54 passed, including three new shared-control/trajectory checks |
| Full workspace typecheck | Passed after preserving optional command capabilities |
| Full game/auth unit suite | 259/259 passed |
| Full API suite | 163/164 passed; campaign settlement timeout failure below |
| Existing Node/Chromium replay fixtures | Six fixtures matched exactly; these fixtures do not certify Orbital-specific browser flight |
| Main app and offline Lab builds | Passed; four static routing/lazy-Three.js build checks passed |
| Development service restart | Frontend, API and Wing socket started successfully |
| HTTP checks | `/api/healthz` and `/api/world/operations` returned 200 |
| Preview screenshot | Offline Lab entry rendered without a browser error; no interactive flight/device certification |
| Architecture files | All ten present; local links checked |

### Release blocker: campaign timeout/replay boundary

`progression.test.ts` failed at the requirement that the generated match finish
inside its replay frame cap. A deterministic local reproduction with Contact,
Mandjet, refit 1, practice, seed 2 reaches 7,200 ticks with time
`119.99999999999447`, below the 120-second timeout. One extra tick resolves loss,
but the existing replay cap rejects that extra frame.

The timer, replay cap and campaign simulation sources were unchanged by this
extraction. This is a reproducible existing readiness defect, not a clean full
regression result. Do not hide it by rerunning random seeds until the suite
passes. Repair requires a deliberate compatible/versioned timeout and settlement
policy, with boundary and historical-replay tests; silently applying a global
epsilon to issued rules is not part of this extraction.

**Status: not ready for staging promotion or Production.**

## Release boundaries

The branch starts at fetched remote staging source and includes the prior
integration branch as a prerequisite merge. This does not establish that those
prior changes have matching live staging services or human-play evidence.
Keep the new extraction independently reviewable and do not merge main/staging
or deploy without the appropriate approval.

## Open gates

1. Complete behavioral review of archived/remote-only source candidates.
2. Fix the campaign timeout boundary while preserving issued-run compatibility.
3. Consolidate duplicated client/server combat orchestration.
4. Pin sector advertised rules to actual room dispatch.
5. Complete mobile interaction and presentation parity, then actual-device tests.
6. Migrate the remaining modes with authoritative objectives and settlement.
7. Implement main-engine world streaming/encounters/anomalies behind bounded tests.
8. Certify real authenticated Orbital asteroid competition and observer isolation.

The master directive is implemented as an ordered consolidation programme.
The complete eight-phase game is **not** marked finished by this first slice.
