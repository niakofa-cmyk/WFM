# Persistent universe and economy depth verification

**Inspected and tested source:** `0a04fcbac5304f41de83f722a4e7f3d0fc88f2a7`  
**Date:** 2026-10-20  
**Scope:** the revised roadmap's Step 7 (universe) and Step 8 (economy and ship progression).

This numbering differs from the older step-numbered reports. This is an audit, not an implementation of the missing features. Application source was not changed. Nothing was published, no production database was queried or changed, and production readiness is not claimed.

## Verdict

- **Step 7: PARTIAL / not complete.** Persistent travel, discoveries, contracts, and faction counters work, but location-specific activities, material salvage, consequential reputation, and player-influenced world changes are missing.
- **Step 8: BLOCKED / not complete.** Atomic transactions and request deduplication work within existing coverage, but an authenticated player can generate credits through ordinary immediate buy/sell orders. Materials also have no consumption or ship-progression purpose.

Passing the current tests does not certify these completion criteria.

## Evidence run

```sh
pnpm --filter @workspace/api-server exec tsx --test --test-concurrency=1 \
  src/game/market-world.test.ts \
  src/game/progression.test.ts \
  src/routes/progression.test.ts
```

**Result: 8 passed, 0 failed, 0 skipped.**

Coverage exercised:

- Two accounts competing for the final unit of shared stock; exactly one succeeds.
- Matching trade request replay, conflicting reuse of a request key, sale history, and shared stock visibility.
- Persistent discoveries and contracts, route/progression gates, concurrent duplicate travel, and single-award quest claims.
- Separate player profiles, refit balances, and strike-claim ownership.
- Replay frame/input validation and rejection of client-authored balances/progression.
- Unauthenticated progression, market, and world HTTP requests return `401`.

These are development service/database and route tests, not authenticated browser journeys or deployed-account certification. Test fixtures were cleaned up by the existing tests.

## Release-blocking finding: repeatable immediate-trade profit

**Confirmed through the real `tradeMarket` service against a temporary development test account.**

Controlled listing: salt base price 40, stock/target stock 100, demand 0. The observed event applied no salt price modifier. Account starting credits: 10,000.

| Round | Buy | Immediate sale | Ending credits | Ending cargo | Ending stock |
| --- | --- | --- | --- | --- | --- |
| 1 | 50 at 40 CR/unit | 50 at 59 CR/unit | 10,950 | 0 | 100 |
| 2 | 50 at 40 CR/unit | 50 at 59 CR/unit | 11,900 | 0 | 100 |

**Net result: +1,900 credits, no retained cargo, and unchanged final stock.** Every order used its own legitimate request key. No forged balance, duplicate reward, malformed quantity, or authentication bypass was needed.

The diagnostic restored the original listing and removed its temporary account, inventory, and transaction rows.

Cause: `quote()` in `artifacts/api-server/src/game/market.ts` calculates one price for both sides from the pre-order market state. A buy raises the stock/demand-based quote; the subsequent sale receives that higher quote before returning the market to its original state. Transaction locking and idempotency do not prevent this business-logic exploit.

Required correction: adopt a pricing rule that cannot guarantee positive profit on an immediate unchanged-world round trip, including bulk orders, rounding, event modifiers, and clamp boundaries. Add permanent regression tests before calling the economy safe. Do not merely add a duplicate-request check; all four orders above were distinct.

## Step 7 requirement matrix

| Requirement | Finding |
| --- | --- |
| Distinct locations and activities | **Partial.** Six named locations have descriptions and service labels. Implemented activities are travel, a one-time exploration action, contract actions, and the Phobos market. Labels such as Salvage, Wreck access, Beacon service, and Armory do not provide corresponding dedicated actions in the world service. |
| Map expansion and progression | **Partial.** Six locations form a linear route chain with credit fares and campaign-clear thresholds. No expanded regions, branching route progression, or event/reputation-driven access was found. |
| Station services, salvage, contracts | **Partial.** Four persistent contracts support accept/explore/claim; acceptance requires Phobos and claims require the destination. Exploration awards reputation, not recovered material inventory. |
| Faction consequences | **Missing depth.** Exploration and claims increment the selected faction's counter. Reputation is displayed but does not gate services, alter prices/contracts, or cause opposing-faction consequences. |
| Events affect opportunities and economy | **Partial.** Three scheduled daily events apply price multipliers. They do not modify stock, route availability, contract availability, or location activities. Demand/stock change through trades, not event-driven replenishment or shortages. |
| Persistent discoveries/world changes | **Partial.** Location, personal discoveries, contracts, reputation, and dated global event records persist. No player-driven shared conflict state or persistent consequences beyond these records were found. |
| Backend-unavailable recovery | **Partial.** The galaxy screen offers Retry Link and Back to Hangar; failed actions display errors and retain request keys while mounted. Pending action keys are not durably stored across reload/unmount. Recovery after an unknown commit outcome was not fault-injection tested. |

Primary sources: `artifacts/api-server/src/game/world.ts`, `artifacts/war-for-mars/src/game/GalaxyScreen.tsx`, and `lib/db/src/schema/universe.ts`.

## Step 8 requirement matrix

| Requirement | Finding |
| --- | --- |
| Complete market interface | **Partial.** Prices, stock, holdings, quantities, buy/sell totals, event effects, recent ledger entries, refresh, and errors are implemented. Human usability and authenticated browser behavior were not tested in this audit. |
| Useful trade goods | **Not complete.** Salt, iron, dust, and resin are bought/sold and held in inventory. No consumption for repairs, salvage contracts, refits, crafting, or technology was found. |
| Ship upgrades/refits | **Partial.** A server-owned account refit level costs 120 × next level, capped at five. The single-player simulation applies +6% hull/shields and +4% weapon damage per level. Refits consume only credits, are not ship-specific choices, and were not certified for online parity here. |
| Event-driven prices/supply | **Partial.** Daily event price multipliers work in source; events do not alter actual stock or introduce goods-consuming opportunities. Event rollover behavior was not exercised by the targeted tests. |
| History and failed/retried purchases | **Partial.** Durable trade rows and matching-request replay exist. UI displays six recent trades from twelve returned records. Pending request keys live only in component refs; reload or changing an uncertain order can lose the key needed to resolve its outcome safely. |
| Server-validated purchases/sales/upgrades | **Partial, pricing blocked.** Authenticated routes validate request schemas and use server-owned balances with database locks, transactions, and uniqueness/check constraints. Market/refit service functions do not enforce station presence. A market order also has no maximum accepted total/quote revision, so the displayed price is not a committed price guarantee. |
| Concurrent trades and recovery tests | **Partial.** Last-unit competition and request replay pass. Missing coverage includes immediate round-trip profit, concurrent identical market keys, same-account competing debits, lost responses after commit, and crash/restart recovery. |

Primary sources: `artifacts/api-server/src/game/market.ts`, `artifacts/api-server/src/game/progression.ts`, `artifacts/api-server/src/game/market-world.test.ts`, `artifacts/war-for-mars/src/game/MarketPanel.tsx`, and the corresponding authenticated routes.

## Recovery caveats

- Market request-key retention protects a retry only while that key is still retained in the mounted component. It is not a durable pending-order journal.
- The market-unavailable message says the ledger has not changed. After a committed trade whose response was lost, that assurance may be false; the UI should show an unknown outcome and reconcile with transaction history.
- Server request replay exists, but process/database failure and lost-response scenarios were not exercised by the passing tests.
- A different valid request key represents a new order. Request deduplication cannot infer that it was intended as recovery of an earlier uncertain order.

## Recommended order

1. Close the immediate-trade credit exploit and add price-consent/regression coverage.
2. Make uncertain trade/world/refit outcomes recoverable across reloads, with fault-injection and concurrent-debit tests.
3. Implement one complete salvage → material inventory → station refit/contract loop before expanding the map. Give faction reputation and world events actual effects on that loop.
4. Verify the complete authenticated player journey in isolated staging. Keep deployed certification pending until that separate work is complete.

No production, physical-device, or human playtest claims are made.
