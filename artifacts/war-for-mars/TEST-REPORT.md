# WAR FOR MARS — Reproducible Build, Ship Balance, and Mobile Test Report

**Test date:** 2026-10-20
**Source commit tested:** `87625e57b125fc565ecdb942d46681a6044960c3`
**Result:** Clean-checkout build and automated tests pass. The ship balance gate is open, and physical Android/iOS certification has not been run.

## Reproduction

The source commit was tested from a detached clean Git worktree with Node.js `v24.13.0` and pnpm `10.26.1`.

| Check | Result | Evidence |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | Lockfile current; clean install resolved all 10 workspace projects and reused 538 packages without downloads. |
| `pnpm run typecheck` | PASS | Shared libraries and all artifact/script TypeScript checks completed. |
| `pnpm test` | PASS | 20 tests: API/server 16/16 and game controls 4/4; zero failures. |
| `pnpm run build` | PASS | Workspace production build completed from the clean worktree. |
| `pnpm --filter @workspace/api-server run build:socket` | PASS | API and WebSocket bundles built. |
| `git diff --check` | PASS | No whitespace errors in the tested source commit. |

The game bundle is 763.85 kB minified (209.55 kB gzip), above Vite's 500 kB warning threshold. Build succeeds; physical-device performance is not inferred from this size.

## Multiplayer and combat evidence

- Automated WebSocket test: ten clients fill a room, reconnect, and remain isolated from a second room.
- Six-minute Strike, sequenced input acknowledgement, empty-seat AI fill, and reconnect behavior are covered by the passing API tests.
- The ship harness tested 160 seeded 1v1 duels per cohort, both seat orientations, plus mobility and isolated ability drills. It now also runs five full AI-vs-AI 5v5 Strikes per ship per cohort, with objectives, rocks, and respawns. Both cohorts are reproducible with `pnpm --filter @workspace/api-server run certify:ships -- --seeds=5 --seed-offset=0` and `pnpm --filter @workspace/api-server run certify:ships -- --seeds=5 --seed-offset=5`.
- The 5v5 samples are small and the production AI does not activate ultimates, so those outcomes are smoke/diagnostic evidence, not a human-play balance pass. The repeatable results and limits are in `SHIP-CERTIFICATION.md`.
- A first harness incorrectly omitted lock opportunities; after correcting lock and velocity-led aim, Sundara moved from an invalid 0% result to 50% in both cohorts. No ship-stat change from this certification was accepted.

## Mobile evidence and limits

The four automated mobile-control tests pass: combined touch actions, the input-reset helper used for lost-focus behavior, gyro permission denial with touch fallback, and gyro grant/calibration/orientation reset/listener cleanup. App-level visibility, pointer-cancel, and orientation handlers are present but still need physical-browser validation.

No physical Android or iPhone test run was performed. Android Chrome and iOS Safari frame rate, frame pacing, memory, thermal behavior, full six-minute play, and hands-on touch controls remain **NOT RUN**. The evidence matrix and acceptance procedure are in `MOBILE-CERTIFICATION.md`; the tactile checklist is `PHONE-PLAYTEST-CHECKLIST.md`.

## Current disposition

- **Reproducible build and automated tests:** PASS on the source commit above.
- **Eight-ship measurements and balancing process:** documented; **balance gate not passed** until high/low outliers receive human 5v5 review and follow-up cohorts.
- **Physical mobile certification:** **NOT RUN** on Android Chrome or iOS Safari; do not mark Step 4 complete.
