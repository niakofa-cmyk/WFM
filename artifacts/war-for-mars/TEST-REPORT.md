# WAR FOR MARS — Reproducible Build, Multiplayer, Ship Balance, and Mobile Report

**Test date:** 2026-10-20
**Code commit verified:** `fa1d75e7d7d4fb9acd13925d08430a25bbf8fe9b`
**Result:** Workspace typecheck, all 40 automated tests, production builds, and the seeded ship diagnostic pass. The lockfile and dependencies are unchanged from the prior frozen-install verification. Production database and real phone/account runs are not available in this workspace.

## Reproduction

Verified on the exact source commit above using Node.js `v24.13.0` and pnpm `10.26.1`. The frozen-lockfile install passed on the package-identical prior checkpoint; this change adds no dependencies or lockfile updates.

| Check | Result | Evidence |
| --- | --- | --- |
| `pnpm install --force --frozen-lockfile` | PASS | Reinstalled 558 workspace packages from the frozen lockfile; no lockfile changes. |
| `pnpm run typecheck` | PASS | Shared libraries, artifacts, and scripts completed. |
| `pnpm test` | PASS | 40 tests total: API/server 34/34 and game client 6/6; zero failures. Workspace packages and API test files run serially to avoid ten-client test contention. |
| `pnpm --filter @workspace/api-server exec tsx --test src/socket/network-impairment.test.ts` | PASS | Ten-client seeded impairment run; see network evidence below. |
| `pnpm run build` | PASS | All workspace production builds completed. |
| `pnpm --filter @workspace/db run push` | PASS | Non-forced Drizzle push against development PostgreSQL 16.10; all 10 expected tables and 4 enum types are present. No production database is configured here. |
| Unauthenticated API guards | PASS | Protected profile, market, world, travel, strike, and reward routes returned HTTP 401. |
| Public sign-up route | RENDERED | Clerk sign-up form appeared in a 402×874 development preview; the page showed development keys. No account was created or signed in. |
| GitHub Actions workspace quality | PASS | The corrected code passed on [`00acd93`](https://github.com/niakofa-cmyk/WFM/commit/00acd93bff2eb75d9236641259b6f39647c7d6b9) ([run 39485700573](https://github.com/niakofa-cmyk/WFM/actions/runs/39485700573)); latest main `3941128` also passed ([run 39486144312](https://github.com/niakofa-cmyk/WFM/actions/runs/39486144312)). |

The game bundle is 773.67 kB minified (212.53 kB gzip), above Vite's 500 kB warning threshold. The build succeeds; no physical-device performance is inferred from bundle size. At runtime, the API listened on port 8080 and the Wing Socket server on port 8099.

The root test script serializes package test runs to avoid ten-client test contention. The failed push check exposed a separate reconnect race: the client sent input on a replacement socket before the server's `joined` acknowledgement, so the server rejected pre-join input. Online input transmission is now gated by the acknowledged socket, and the impairment harness pauses input until the reconnect seat is reclaimed. The standalone impairment test passed five consecutive runs, and the full workspace quality command passed.

The repository uses Drizzle schema push rather than checked-in versioned migration files. Only the development database was synchronized and inspected; production schema application and production authentication were not verified.

## Multiplayer and six-minute Strike evidence

- Ten simultaneous WebSocket clients receive balanced 5v5 seats, ready up, launch through the host gate, and complete the six-minute match clock; each sends sequenced input and receives the server's final match result. The test accelerates server ticks and keeps snapshots at 30 Hz so the six-minute clock completes in about 12 seconds.
- Separate automated coverage verifies full-room rejection, late-join rejection after launch, independent invite-code rooms, five-second reconnect reservation, a 150 ms delayed input acknowledgement, bounded input values/sequences, message-rate limits, and stale-session handling after a server restart.
- Each craft now owns a lock target. Lock input, Duskbreaker auto-lock, and Sundara homing are team-aware; connected non-lead seats are no longer treated as AI for firing behavior. Tests verify all ten seats can acquire a hostile independently, both teams' Sundara shots home to the correct side, and Duskbreaker can auto-lock from either team.
- Known multiplayer input gap: non-lead pilots still do not apply their own evade, pitch, or power-preset inputs in the server simulation. Full control parity is not certified.
- Lobby sessions are in-memory. A server restart deliberately reports that the old room cannot be restored; clients must create a fresh room. It does not recover an interrupted match. Empty disconnected rooms are reaped automatically, and a connected but idle lobby expires after 15 minutes; the long timeout itself was not waited out in an integration test.
- The 150 ms input acknowledgement and the new impairment test run locally; neither is a WAN test or a ten-person playtest. Regional latency, sustained internet load, and carrier-specific behavior remain untested.
- Sequenced input acknowledgement, AI fill for empty seats, server-side strike reward replay, and six-minute timer resolution are covered by passing API tests.
- The six-minute Strike simulation reaches the timer boundary and resolves tied integrity. This verifies runtime behavior, not qualitative combat polish or human competitive balance.

## Ten-client network impairment and reconnect evidence

- Reproduce with `pnpm --filter @workspace/api-server run test:network` from the repository root.
- Ten clients use independent local WebSocket proxies with deterministic per-client seeds, 35 ms base one-way delay, ±20 ms jitter, and 12% loss applied to client input and server snapshots.
- During the active match, two links are forcibly terminated and reconnected with their existing room tokens; the server reclaims both original seats.
- The test requires a byte-identical authoritative snapshot at a common server tick for all ten clients, then verifies that every client receives the same completed match outcome and all ten seats are connected with accepted sequenced inputs.
- Sample passing run: 10/10 links exercised delay and loss in both directions; each link dropped 27–37 input frames and 34–51 snapshots; sampled delay was 15–55 ms. Reconnected seats were server slots 1 and 8. All clients shared the authoritative snapshot at tick 110; the match ended at game time 360 seconds on server tick 10880.
- This test stresses short controlled impairment and reconnection. It does **not** certify ten real devices, internet/WAN paths, longer outages, longer-duration server load, or all combat/objective consistency under human play. The existing separate test remains the six-minute timer-boundary check.

## Ship-balance diagnostic

- Reproduced with `pnpm --filter @workspace/api-server run certify:ships -- --seeds=20 --seed-offset=50` on the tested source commit.
- Coverage: 640 capped 1v1 duels, 80 focal-seat results per ship, and 20 AI-vs-AI 5v5 Strike simulations per ship.
- The harness normalizes both pilots to 5 shield-regeneration points per second, uses a symmetric 9-point integrity loss, and now supports lock/homing on both sides.
- The 20-seed cohort covered 640 scripted 1v1 duels, 80 focal appearances per ship, all 16 cross-faction ship pairings, and 20 AI-vs-AI 5v5 Strikes per ship. Full measurements and review flags are in `SHIP-CERTIFICATION.md`.
- The corrected run materially changed results for Duskbreaker and Splitter Ring compared with the previous asymmetric benchmark. Treat the earlier figures as obsolete; do not tune from scripted results alone.
- **Eight-ship balance gate: NOT PASSED.** Human-versus-human and human-versus-AI playtests across all eight ships remain outstanding.

## Mobile evidence and limits

The four automated mobile-control tests pass: combined touch actions, input reset for lost focus, gyro permission denial with touch fallback, and gyro grant/calibration/orientation reset/listener cleanup. App-level visibility, pointer-cancel, and orientation handling still need physical-browser validation.

No physical Android or iPhone test run was performed. Android Chrome and iOS Safari behavior, frame rate, frame pacing, memory, thermal performance, full six-minute play, and hands-on touch controls remain **NOT RUN**. The development sign-up page preview is not physical-device evidence. See `MOBILE-CERTIFICATION.md` and `PHONE-PLAYTEST-CHECKLIST.md`.

## Current disposition

- **Step 1 — reproducible build and automated checks:** automated checks PASS on the exact source commit above. Full completion remains **PARTIAL** because no production database is configured and registration/sign-in/profile loading were not completed with a real account.
- **Step 2 — six-minute Strike runtime:** automated timer and outcome tests pass; qualitative combat polish is not certified here.
- **Step 3 — eight-ship balance:** lock/homing symmetry is corrected and seeded diagnostics are documented; the balance gate remains open pending human-versus-human and human-versus-AI playtests.
- **Step 4 — authoritative online 5v5:** local ten-client, room-isolation, reconnect, and seeded impairment tests pass. Ten real human clients, WAN paths, sustained server load, and cross-device consistency remain **NOT CERTIFIED**.
- **Step 5 — independent lobbies and controlled launch:** PASS for invite-code rooms, ready-up, team assignment, host launch, full-room handling, and late-join rejection. Disconnected-room and 15-minute idle cleanup are implemented; the long timeout was not timed in a test.
- **Mobile physical-device certification:** **NOT RUN** on Android Chrome or iOS Safari; see `MOBILE-CERTIFICATION.md`.
