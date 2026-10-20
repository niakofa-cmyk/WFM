# WAR FOR MARS — Multiplayer and Strike Validation Report

**Test date:** 2026-10-20
**Source commit tested:** `a502edc82ecee8834c1a093893cc327759223173`
**Status:** Workspace build and server-side multiplayer checks passed. Physical-phone acceptance is still pending.

## Automated evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Workspace build | PASS | `pnpm run build` completed root typechecks and builds for the configured workspace artifacts. |
| Workspace tests | PASS | `pnpm test`: 8 passed, 0 failed. |
| Six-minute strike simulation | PASS | A full 60 Hz, 360-second simulation reached the strike timer boundary and closed with a result. |
| Ten-client multiplayer | PASS | Ten WebSocket clients occupied seats 0–9; teams were split 5/5. |
| Room isolation | PASS | A second room had its own slot 0; input sequence acknowledgement in the first room stayed at 0 in the second. |
| Reconnect | PASS | A replacement connection reclaimed the disconnected pilot’s original seat using its reconnect token. |
| Reward API validation | PASS | A valid replay claim returned a server-computed result; an invalid input claim returned HTTP 400. |
| API and socket runtime | PASS | API health returned HTTP 200; socket health returned HTTP 200 and the socket bound to port 8099. |
| Routed WebSocket/API smoke | PASS | The routed API health request returned HTTP 200; the routed WebSocket joined a room and received its assigned seat. |

The repeatable integration tests are in `artifacts/api-server/src/socket/server.test.ts`, `artifacts/api-server/src/game/rewards.test.ts`, and `artifacts/api-server/src/routes/strikes.test.ts`.

## Physical-device status

**Not tested on physical phones.** No physical device or device farm was available to this run. Desktop preview screenshots and loopback WebSocket tests are not evidence of actual-phone usability, frame rate, memory use, touch behavior, or audio behavior. The two-phone test procedure is in `PHONE-PLAYTEST-CHECKLIST.md`.

The phone acceptance still needs two devices to check the room-code join, separate rooms, reconnect seat hold, all eight ships’ touch controls, the two-minute practice match, and a six-minute match on hardware.

## Known limits

- Strike outcomes and reward amounts are now recomputed by the API server from a bounded replay; the browser no longer calculates the grant. Credits and campaign progress are still stored in local storage, not in an authenticated server-side account ledger. This does not yet provide durable, cheat-resistant player balances.
- The WAR FOR MARS client bundle is 758.74 kB minified (207.98 kB gzip), above Vite’s 500 kB chunk warning threshold. The production build succeeds, but this bundle has not been measured on a phone.
- Room state is process-memory state. A server restart ends active rooms.
