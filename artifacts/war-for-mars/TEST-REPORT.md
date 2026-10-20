# WAR FOR MARS — Reproducible Build, Multiplayer, Ship Balance, and Mobile Report

**Test date:** 2026-10-20
**Code commit verified:** `e9317e2a818af0f6e7b0254b9ee5aade7fdae57a`
**Result:** Workspace checks and automated ten-client room/match tests pass. Ship balance, realistic-network certification, and physical phone certification remain open.

## Reproduction

Verified on the exact source commit above using Node.js `v24.13.0` and pnpm `10.26.1`.

| Check | Result | Evidence |
| --- | --- | --- |
| `pnpm run typecheck` | PASS | Shared libraries, artifacts, and scripts completed. |
| `pnpm test` | PASS | 25 tests total: API/server 21/21 and game controls 4/4; zero failures. |
| `pnpm run build` | PASS | All workspace production builds completed. |
| `pnpm --filter @workspace/api-server run build:socket` | PASS | API and WebSocket bundles built. |
| `git diff --check` | PASS | No whitespace errors before the code commit. |
| Proxied `/healthz`, `/api/healthz`, and `/ws` | PASS | Both services returned healthy; browser-proxy WebSocket handshake joined a lobby. |

The game bundle is 773.67 kB minified (212.53 kB gzip), above Vite's 500 kB warning threshold. The build succeeds; no physical-device performance is inferred from bundle size. At runtime, the API listened on port 8080 and the Wing Socket server on port 8099.

## Multiplayer and six-minute Strike evidence

- Ten simultaneous WebSocket clients receive balanced 5v5 seats, ready up, launch through the host gate, and complete the six-minute match clock; each sends sequenced input and receives the server's final match result. The test accelerates server ticks and keeps snapshots at 30 Hz so the six-minute clock completes in about 12 seconds.
- Separate automated coverage verifies full-room rejection, late-join rejection after launch, independent invite-code rooms, five-second reconnect reservation, a 150 ms delayed input acknowledgement, bounded input values/sequences, message-rate limits, and stale-session handling after a server restart.
- Lobby sessions are in-memory. A server restart deliberately reports that the old room cannot be restored; clients must create a fresh room. It does not recover an interrupted match. Empty disconnected rooms are reaped automatically, and a connected but idle lobby expires after 15 minutes; the long timeout itself was not waited out in an integration test.
- These are local automated tests, not a ten-person playtest or a WAN test. The 150 ms delay is a local input delay; packet loss, jitter, regional latency, and sustained internet load remain untested.
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
- **Step 5 — independent lobbies and controlled launch:** PASS for invite-code rooms, ready-up, team assignment, host launch, full-room handling, and late-join rejection. Disconnected-room and 15-minute idle cleanup are implemented; the long timeout was not timed in a test.
- **Step 6 — authoritative multiplayer:** automated ten-client full-match, reconnect, input-validation, room-isolation, and restart-failure handling pass. Realistic-network reliability and live human play remain **NOT CERTIFIED**.
