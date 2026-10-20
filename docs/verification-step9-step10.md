# Step 9–10 verification: shared economy and persistent universe

**Source commit tested:** `ec04fd01466cf8b90f2512f217e9b030934b83d3`  
**Date:** 2026-10-20  
**Environment:** Replit development workspace and development PostgreSQL database

## Result

The workspace build, typecheck, and automated tests pass. The shared market and campaign-world state are persisted in the development database. This verifies the development implementation; it is not a production-release certification.

## Step 9 — Shared player economy

- Added authenticated `GET /api/market` and `POST /api/market/trades` APIs.
- Market stock and quotes are global rows, while inventory and credits remain account-owned.
- Purchases and sales lock the player balance and shared good row, then update balance, inventory, stock, demand, and the transaction ledger in one database transaction.
- Request idempotency keys are unique per account. Replaying a matching request returns the recorded transaction; reusing its key for a different trade is rejected.
- Concurrent purchases cannot oversell stock. Database constraints also reject invalid market prices, stock, demand, quantities, and balances.
- Every market response includes the current shared quote, player inventory, credits, and recent transaction history.
- The client refreshes the shared price book every five seconds and retains a request key after an uncertain failure so a retry does not repeat the trade.

### Quote model

For each good, the server computes a quote from its base price, current supply, recent trade pressure, and the current world-event modifier:

`round(base × (1 + 0.45 × supplyPressure + 0.25 × demandScore/100) × eventModifier)`

`supplyPressure` is `(targetStock − stock) / targetStock`, clamped to `−0.5…1`. Demand score is clamped to `−100…100`; a buy adds two points per unit and a sale removes two. Quotes are bounded to 50%–200% of base price. The event modifier is applied server-side and shown with the listing.

Automated tests verify that a repeated purchase does not charge twice, selling updates the inventory and shared market, and two players competing for the final unit result in exactly one successful purchase.

## Step 10 — Persistent universe

- Added six campaign locations. Mission clears unlock later locations; each account’s discoveries persist in the database.
- Added four server-backed side operations. Acceptance, location requirements, rewards, and reputation changes are validated and recorded server-side.
- Exploration and quest actions are idempotent. Quest credits and reputation are updated in the same transaction as the durable quest/reward records.
- Added persistent daily UTC world events. The selected event is stored once per day and its market modifiers affect shared quotes.
- Added `/api/readyz` as a database readiness check while retaining `/api/healthz` for liveness.
- **Client decision:** keep the web client for now. This implementation and its current browser preview provide no measured evidence that a native-engine migration would improve the result. Revisit after physical-device profiling.

Automated tests verify that two accounts receive the same event, exploration/reputation persist for one account only, and a quest reward can be claimed only once.

## Verification evidence

| Check | Result |
| --- | --- |
| `pnpm --filter @workspace/db run push` | Passed; additive development schema changes applied |
| `pnpm -w run typecheck` | Passed |
| `pnpm -w run build` | Passed |
| `pnpm -w run test` | Passed; 26 API-server tests and 6 game tests |
| API readiness request | `GET /api/readyz` returned `200 {"status":"ready","database":true}` |
| API liveness request | `GET /api/healthz` returned `200 {"status":"ok"}` |
| Multiplayer regression | Existing ten-client room and authoritative match tests passed |
| Browser evidence | [`docs/evidence/step9-step10-public-preview.jpg`](evidence/step9-step10-public-preview.jpg) |

The production database was not modified. The screenshot is the unauthenticated public landing page; the browser preview cannot sign in, so the authenticated market and galaxy screens were verified by typecheck and server-backed tests rather than by a signed-in screenshot. Android Chrome, iOS Safari, and physical-device performance were not tested, as previously authorized.

## Remaining release checks

- Run the new schema against the production database as part of a deliberate publish/migration.
- Verify market visibility and transaction history through two separate authenticated sessions on the deployed service.
- Profile the authenticated game and market on representative Android and iOS devices.
- Review the frontend bundle-size warning from the build (the game JavaScript chunk is about 922 kB before gzip).
