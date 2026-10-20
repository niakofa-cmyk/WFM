# WAR FOR MARS — Reproducible Build and Combat Report

**Test date:** 2026-10-20
**Source commit tested:** `2074199fd271b2ee3b0bce13544792f3981730e2`
**Result:** Clean-checkout workspace build and tests passed. Actual-phone acceptance remains outstanding.

## Reproduction environment and commands

- Node.js `v24.13.0`
- pnpm `10.26.1`
- Fresh detached worktree at the source commit above
- `pnpm install --frozen-lockfile` — PASS; lockfile was current across all 10 workspace projects.
- `pnpm run typecheck` — PASS.
- `pnpm run build` — PASS; workspace builds completed.
- `pnpm --filter @workspace/api-server run build:socket` — PASS.
- `pnpm test` — PASS; 15 passed, 0 failed.

The game build also completed directly with `pnpm --filter @workspace/war-for-mars run build`. The API package build emits both `dist/index.mjs` and `dist/socket.mjs`.

## Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Six-minute Strike | PASS | Automated 60 Hz simulation reached 360 seconds and resolved the tied-integrity result. |
| Flight controls | PASS | Unit tests verify eased turning and stronger counter-thrust than coasting. |
| Enemy targeting | PASS | Tests verify escort priority, exposed-target selection, and projectile lead interception. |
| Match comprehension | PASS | Tests cover relay capture/contest callouts and team-relative outcomes/reasons. |
| Weapon/cooldown band | PASS | All eight ships meet the tested 16–22 sustained-DPS and 7–12 second ultimate-cooldown bands. |
| Ten-client server smoke | PASS | Ten live clients filled seats 0–9 across two 5-seat teams; input sequence 1 was acknowledged. |
| Room isolation | PASS | A second live room kept its own `lastSeq` at 0 while the first room acknowledged input 1. |
| Multiplayer and reward tests | PASS | Existing server tests plus new combat tests: 15 total, no failures. |
| API runtime | PASS | API health returned HTTP 200; socket process listened on port 8099. |

The server and client combat engines were compared after the changes; their only remaining difference is the server-only AI control branch for the unoccupied player seat. Ship balance data matches in both copies.

## Combat changes included in the tested commit

- Flight controls now ease steering input, coast more gradually, and respond more strongly to counter-thrust.
- AI prioritizes the escort objective, favors exposed targets, and leads moving targets based on projectile speed.
- Sustained damage values were brought into a narrower band; cooldowns for the support and ram abilities were shortened modestly.
- The in-match HUD labels shield and hull, reports relay ownership/capture progress/contesting, and explains the result from each team’s perspective.
- The debrief states the specific reason the match ended.

## Physical-device status

**Not tested on physical phones.** No physical device or device farm was available to this run. A browser viewport and WebSocket smoke test do not verify real-device frame rate, touch behavior, memory use, or audio. The two-phone procedure is in `PHONE-PLAYTEST-CHECKLIST.md`; it still needs a hardware run.

## Known limits

- The game JavaScript bundle is 762.99 kB minified (209.29 kB gzip), above Vite’s 500 kB warning threshold. It builds successfully but has not been measured on a phone.
- Replay outcomes and reward amounts are recomputed by the API server; credits and campaign progress remain in local storage rather than an authenticated persistent account ledger.
- Multiplayer room state is held in process memory and ends when the socket server restarts.
