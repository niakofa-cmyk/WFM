# Mobile bundle profile and persistent travel loop

**Code commit tested:** `9f23bcbc71b69252c3544fefa63816d2a1587533`  
**Date:** 2026-10-20  
**Environment:** Replit development workspace and development PostgreSQL database

## Result

The campaign world now has a server-backed travel loop, and the large combat dependency is deferred until a match is opened. Workspace typecheck, tests, and build pass. This is a bundle-transfer profile, not a physical-device performance certification.

## Mobile bundle profile

The prior game build had one 922,526-byte JavaScript entry (253,466 bytes gzip). In the tested build, the initial JavaScript entry is 293.62 kB (87.61 kB gzip), a 68% raw / 65% gzip reduction. Vite loads the game modules when their screens are opened:

| Chunk | Raw | Gzip | Loaded when |
| --- | ---: | ---: | --- |
| Initial entry | 293.62 kB | 87.61 kB | App entry |
| WAR FOR MARS application | 68.73 kB | 21.45 kB | Signed-in game |
| Galaxy / travel screen | 14.76 kB | 4.36 kB | Theater opened |
| Market screen | 7.75 kB | 2.68 kB | Market opened |
| Combat screen | 56.75 kB | 19.66 kB | Combat launched |
| Three.js engine | 485.58 kB | 121.13 kB | Combat launched |

The complete JavaScript set remains about 927 kB raw / 257 kB gzip; code splitting changes what must load up front rather than removing the game’s total code. The largest individual chunk is now below Vite’s 500 kB warning threshold. The generated static web output is about 2.27 MB uncompressed, including campaign imagery; that is not a native install-size measurement.

The screenshot/browser check used a 402 × 874 viewport and showed the public landing page. The preview browser cannot sign in, so it did not exercise the authenticated travel screen or a match.

**Still not measured:** Android Chrome or iOS Safari on physical devices; actual match FPS or frame-time consistency; browser/game memory; thermal behavior; gyro permissions on hardware; or a complete six-minute battle. Therefore the targets of 60 FPS, ≤1.5 GB RAM, and stable six-minute mobile play remain uncertified.

## Travel, station, and mission loop

- Each account now has a persistent current location, initially Phobos Yard.
- The server exposes only direct routes from that location. Fares are 8–26 credits; route availability depends on campaign clears.
- Travel locks the player profile and world state in one database transaction, charges the server-owned credit balance, updates the location, and records an idempotent progression event. Reusing a key for a different destination is rejected.
- Exploration is only allowed at the current unlocked location. Contracts are accepted at Phobos Yard and can only be claimed at the required location after its discovery is recorded.
- Contract rewards update credits and the selected faction’s reputation. The existing station market is shown when the current location advertises that service; the Hangar retains campaign selection and ship refitting.
- The six campaign locations remain a single-player account progression system; this does not add matchmaking or a shared multiplayer galaxy.

The database schema push was additive and applied to the **development** database only. Production schema, deployment, and authenticated production flows were not changed or verified.

## Verification evidence

| Check | Result |
| --- | --- |
| `pnpm --filter @workspace/db run push` | Passed; additive development schema change applied |
| `pnpm -w run typecheck` | Passed |
| `pnpm -w run test` | Passed; 30 API-server tests and 6 game tests |
| `pnpm -w run build` | Passed; no WAR FOR MARS chunk-size warning |
| API readiness | `GET /api/readyz` returned `200 {"status":"ready","database":true}` |
| API liveness | `GET /api/healthz` returned `200 {"status":"ok"}` |
| Mobile viewport | Public landing page displayed at 402 × 874; not a physical device |

The travel tests verify the Phobos starting point and route fare, reject exploring from the wrong location and traveling to a non-adjacent location, confirm concurrent retries charge once, reject idempotency-key reuse for another destination, and keep another account’s location and discoveries separate.

## Remaining release checks

- Profile the authenticated game on representative Android and iOS devices during a full six-minute match.
- Measure FPS/frame-time, memory, and thermal behavior; verify touch and gyro controls on hardware.
- Test the authenticated world screen and station services end to end on a signed-in client.
- Apply and verify production schema changes through the deliberate production migration process; production was not modified here.
- Continue real-network ten-client multiplayer, reconnect, sustained-load, and server-recovery testing.
