# Engine consolidation regression report

## Scope

2026-11-06 engine-first extraction under the latest master directive.
No appearance redesign, simulation tuning change, wire-protocol rollout,
database migration, authentication change, reward enablement or deployment.

## Implemented slice

- Engine-owned pilot frame, neutral state and normalization.
- Engine-owned Orbital/sector input adapters, preserving existing behavior.
- Shared Rust Disc pilot-axis conversion used by sector flight and Arena input.
- Browser import compatibility path retained; old callers need no migration.
- Regression checks prevent a second browser implementation and compare
  canonical sector/Orbital trajectories at identical tuning and scale.
- Client and API call a shared engine rule to resolve win/loss/time-limit
  outcomes. Floating-point tolerance recognizes the final fixed step without
  adding a frame or changing the replay-length cap.
- Cooperative protocol v2 dispatches the Orbital v2 rules in its handshake;
  protocol v1 retains the existing server runtime and default rollout.
- Combat/ability coordinators remain duplicate owners, enforced byte-equal with
  tests. This is not a completed single-file combat-loop extraction.

## Evidence

| Check | Observed result |
|---|---|
| Check | Observed result |
|---|---|
| Workspace typecheck | Passed |
| Main game/auth suite | 263/263 passed |
| API, socket, and staging-helper suite | 166/166 passed |
| Existing Node/Chromium replay fixtures | Six exact fixtures matched; these do not certify Orbital-specific browser flight |
| Main app and standalone Combat Lab builds | Passed; four static routing and lazy-renderer checks passed |
| Frontend, API and Wing Socket development workflows | Restarted successfully |
| Development API health and operation directory | Both returned HTTP 200 |
| Combat Lab preview | Launch screen rendered without a browser error; interactive flight was not exercised in this capture |
| Architecture documentation | Ten files; local links verified |

### Resolved reproducer: campaign timeout/replay boundary

`progression.test.ts` failed at the requirement that the generated match finish
inside its replay frame cap. A deterministic local reproduction with Contact,
Mandjet, refit 1, practice, seed 2 reaches 7,200 ticks with time
`119.99999999999447`, below the 120-second timeout. One extra tick resolves loss,
but the existing replay cap rejects that extra frame.

Client and API now call the same terminal-outcome rule, which recognizes the
bounded floating-point boundary as the current final step. It adds no extra
frame. The deterministic seed-2 fixture must pass alongside historical replay
fixtures; do not hide failures by rerunning random seeds.

## Release boundaries

The branch starts at fetched remote staging source and includes the prior
integration branch as a prerequisite merge. This does not establish that those
prior changes have matching live staging services or human-play evidence.
Keep the new extraction independently reviewable and do not merge main/staging
or deploy without the appropriate approval.

## Open gates

1. Complete behavioral review of archived/remote-only source candidates.
2. Extract the still-duplicated client/API AI, weapon and ability orchestration
   into the shared engine without artifact-to-artifact imports.
3. Complete mobile interaction and presentation parity, then actual-device tests.
4. Migrate remaining modes with authoritative objectives and settlement.
5. Implement main-engine world streaming/encounters/anomalies behind bounded tests.
6. Certify real authenticated Orbital asteroid competition and observer isolation.

The master directive is implemented as an ordered consolidation programme.
The complete eight-phase game is **not** marked finished by this first slice.
