# WAR FOR MARS — Reproducible Build, Multiplayer, Ship Balance, and Mobile Report

**Test date:** 2026-10-20
**Code commit verified:** `d1a9ad8dc2280732cd2eef7e328df0035332f4af`
**Result:** Clean-checkout typecheck, tests, game/API builds, and socket build pass. Ship balance and physical phone certification remain open.

## Reproduction

Verified from a detached clean Git worktree using Node.js `v24.13.0` and pnpm `10.26.1`.

| Check | Result | Evidence |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | Clean worktree; all 10 workspace projects; 538 packages reused, none downloaded. |
| `pnpm run typecheck` | PASS | Shared libraries, artifacts, and scripts completed. |
| `pnpm test` | PASS | 22 tests total: API/server 18/18 and game controls 4/4; zero failures. |
| `pnpm run build` | PASS | All workspace production builds completed. |
| `pnpm --filter @workspace/api-server run build:socket` | PASS | API and WebSocket bundles built. |
| `git diff --check` | PASS | No whitespace errors in the tested source commit. |

The game bundle is 763.85 kB minified (209.55 kB gzip), above Vite's 500 kB warning threshold. The build succeeds; no physical-device performance is inferred from bundle size. At runtime, the API listened on port 8080 and the Wing Socket server on port 8099.

## Multiplayer and six-minute Strike evidence

- The automated WebSocket test connects ten clients, fills a room, verifies reconnect, and confirms a second room remains isolated. This is an automated test, not a ten-person live playtest.
- Sequenced input acknowledgement, AI fill for empty seats, server-side strike reward replay, and six-minute timer resolution are covered by passing API tests.
- The six-minute Strike simulation reaches the timer boundary and resolves tied integrity. This verifies runtime behavior, not qualitative combat polish or human competitive balance.

## Ship-balance diagnostic

- Reproduced with `pnpm --filter @workspace/api-server run certify:ships -- --seeds=20 --seed-offset=50` on the tested source commit.
- Coverage: 640 capped 1v1 duels, 80 focal-seat results per ship, and 20 AI-vs-AI 5v5 Strike simulations per ship.
- The harness normalizes both pilots to 5 shield-regeneration points per second and a symmetric 9-point integrity loss on death; production defaults are unchanged.
- The current simulator stores lock/homing state on the player match. Scripted opponents cannot use equivalent lock/homing, so the 1v1 results are diagnostics only, not fair head-to-head balance evidence.
- Sentinel-G cooldown and shield candidates were tested independently and reverted because neither changed the 80-0-0 record or 360-second first-life survival. No ship-stat changes were retained. Full results and limitations are in `SHIP-CERTIFICATION.md`.
- **Eight-ship balance gate: NOT PASSED.** Per-craft lock/homing and human 5v5 validation are still needed.

## Mobile evidence and limits

The four automated mobile-control tests pass: combined touch actions, input reset for lost focus, gyro permission denial with touch fallback, and gyro grant/calibration/orientation reset/listener cleanup. App-level visibility, pointer-cancel, and orientation handling still need physical-browser validation.

No physical Android or iPhone test run was performed. Android Chrome and iOS Safari behavior, frame rate, frame pacing, memory, thermal performance, full six-minute play, and hands-on touch controls remain **NOT RUN**. See `MOBILE-CERTIFICATION.md` and `PHONE-PLAYTEST-CHECKLIST.md`.

## Current disposition

- **Step 1 — reproducible build and automated checks:** PASS on the exact source commit above.
- **Step 2 — six-minute Strike runtime:** automated timer and outcome tests pass; qualitative combat polish is not certified here.
- **Step 3 — eight-ship balance:** measurements documented, but the gate remains open because lock/homing behavior is asymmetric and human 5v5 evidence is absent.
- **Step 4 — physical mobile certification:** **NOT RUN** on Android Chrome or iOS Safari.
