# Shared economy and specialist ship progression

## Reference and scope

Read the complete 246-line document:
`attached_assets/Pasted-Module-Architecture-sharedEconomy-js-Server-Validated-T_1792539703725.txt`.
The original is preserved unchanged. This implements its requirements inside the existing pnpm/TypeScript/API/PostgreSQL architecture, not as a second in-memory `EconomyEngine`.

The earlier universe work remains intact. Salt, iron, relic dust and medical resin keep their existing identifiers and player inventories. Sample commodities, numeric costs, and absolute shield values are illustrative; they do not silently replace the established game balance.

## Issues addressed

| Document concern / sample defect | Implementation |
| --- | --- |
| Trusted mutable `account` object | Authenticated identity chooses the stored profile. Requests cannot submit balances, capacity, installed upgrades or combat bonuses. |
| Boolean mutex plus a single 10 ms sleep | Real database transactions lock the account and shared commodity rows. This works across server processes; a timer is not mutual exclusion. |
| Fractional/NaN/infinite quantities | Strict HTTP schemas and core service validation require whole quantities 1..50 and a recognized side/good. |
| Cargo drifting from inventory | Capacity is derived from server-owned upgrades; usage is summed from all stored commodities under the account lock. No mutable client `currentCargo` counter. |
| Capacity bypass through rewards/upgrades | Both trade purchases and net-increasing salvage/research rewards check the same hold. Costs and material rewards apply atomically. |
| Legacy inventory above capacity | Preserved without deletion. New net-positive cargo is blocked; sales and net-consuming services remain available, including expansion. |
| Unlimited/duplicate upgrades | Permanent flags plus account locking and request deduplication prevent reinstalling or double-charging, including distinct concurrent keys. |
| Same buy/sell quote and own-price-impact profit | Existing quantity-aware bid/ask pricing and maximum-buy/minimum-sell consent remain in place. Round-trip exploit regressions continue passing. |
| Selling beyond maximum stock | Existing shared-stock ceiling and transaction rollback remain enforced. Contract deliveries and daily supply effects use the same bounded stock. |
| Event restrictions accumulated forever | Restriction policy is derived from the current server event, not a mutable accumulating set. Dust embargo suspends public dust buys and sales for that cycle; crafting/authorized deliveries remain allowed. Other events clear the suspension. |
| Lost acknowledgement | Committed receipts replay without another debit. Existing account-scoped durable journals retain the same key until acknowledgement. Previously committed receipts remain replayable even if a later event restricts new orders. |
| Failed transactions only in process memory | Known authenticated business rejections are persisted after the primary transaction rolls back, deduplicated by account/action/request key, and displayed with reasons. At most 50 entries per account are retained. |
| Concurrency test that cannot afford a single order | Replacement tests force accepted and rejected orders and assert exact conservation under same-account and cross-account contention. |

Malformed/unauthenticated requests are rejected by the existing schema/auth boundary and structured HTTP logging; they do not create private business-history entries. Database-outage failures cannot be promised a database audit record. Successful financial effects still require committed ledger records.

## Specialist upgrades

All three are Phobos services, paid with account-owned credits and real materials. Existing material refits and hyperdrive tiers remain available.

| Upgrade | Cost and prerequisite | Actual effect |
| --- | --- | --- |
| Shield array Mk II | 1,500 CR; 2 iron, 5 dust; one campaign clear | +25% player shield capacity in solo battle, preserved through power allocation. Included in server-owned strike configuration and replay simulation. No hull/damage bonus; online 5v5 remains normalized. |
| Cargo expansion | 2,500 CR; 20 iron; one campaign clear | Shared material hold grows from 100 to 150 units. One installation, not another +50 per retry. |
| Efficient jump coils | 500 CR; 5 salt, 3 dust; hyperdrive tier 2 | Route fares reduced by 25%, rounded up. Both displayed quotes and actual server deductions use the discount. |

The sample's `hyperdrive_v2` is represented by the existing tiered hyperdrive progression, not a second conflicting unlock. Relic dust serves the advanced-component role; iron is structural/refinery material; salt powers navigation/refinery systems; resin supports refits and medical dispatch. Restricted brokerage consumes sensitive dust/resin rather than renaming saved inventory to contraband.

## Interface and recovery

- Galaxy services show cargo usage/capacity and installed upgrades with clear prerequisites or already-installed reasons.
- Market buy buttons respect total shared cargo space; selling remains a recovery path.
- Restricted commodities show the reason and disable both trade directions.
- Rejected requests appear separately from confirmed transactions; a later successful retry does not erase the earlier rejection.
- Definitive rejection feedback no longer incorrectly describes every failure as an unknown outcome.
- Incompatible read-only snapshot caches use a new schema version; unresolved request journals are retained.
- The market refreshes every five seconds and world state every fifteen seconds. Every write is revalidated regardless of cached UI state.

## Schema rollout

The additive development schema was applied through the existing Drizzle workflow. A reviewed-environment SQL equivalent is at `docs/migrations/specialist-economy.sql`. No inventory reset or production migration was performed.

## Verification

**Tested implementation commit:** `c4c374d8ff7a366d04c7de84a0eb01eaf82105e3` (`staging`).
Only documentation changed after this source commit.

```sh
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run push
pnpm run build
pnpm test
```

- Workspace typecheck and every production build passed.
- Full suite: **47 API tests + 9 client tests = 56 passed**, zero failed/skipped.
- Same-account burst: ten orders with five free cargo units => exactly five accepted, five rejected; exact balance, stock and inventory conservation.
- Two-account burst: ten orders for three available units => exactly three accepted, seven rejected; shared quotes and private histories checked.
- Additional coverage: permanent/concurrent upgrade installation, read-only combat configuration, actual discounted fares, capacity enforcement on service rewards, safe legacy-overage exits, event transition/restriction policy, prior-receipt recovery, bounded rejection history, and shield scaling for every ship in both simulation packages.

## Signed-in browser evidence

Supported programmatic Clerk sign-in with test claims used a fresh isolated identity. Only that account was seeded: 10,000 CR, four clears, hyperdrive tier 2, Accord standing 55, and 45 material units. No owner account or production resource was used.

| Checkpoint | Result |
| --- | --- |
| Initial capacity | 45/100 units, no specialist upgrades. |
| Permanent purchases | Expansion: -2,500 CR/-20 iron; shields: -1,500 CR/-2 iron/-5 dust; efficient coils: -500 CR/-5 salt/-3 dust. Final 5,500 CR and 10/150 cargo. All installed; repeat buttons unavailable. |
| Reload persistence | All three upgrades, credits and materials survived reload/reopening. |
| Actual efficient travel | Rust Disc outbound and return each displayed and charged 6 CR, leaving 5,488 CR. |
| Committed purchase followed by lost acknowledgement | A one-shot wrapper called the original native browser fetch with its real authentication, observed HTTP 200 and the committed receipt, then threw instead of returning it to the application. The DB already held exactly one purchase before reload; the journal remained pending. Reload retried the same key and cleared it. Final count remained one transaction, one 59 CR debit, and iron 8→9: 5,429 CR and 11/150 cargo. |
| Stale capacity race | The UI had a valid 149/150 snapshot while another fixture operation filled the account to 150. A normal unmodified POST returned HTTP 400 for capacity. Credits, inventory, stock and transaction count did not change. A durable rejection reason appeared; fresh UI showed 150/150 with buying disabled. |
| Event restriction and rollover | Dust-lane embargo disabled both dust trade buttons and showed the reason. The event changed to Salvage bounty at the next UTC date during the run. |
| Mobile-width UI | At 390×844, document/body width stayed 390; market cards, cargo and rejection reasons wrapped without horizontal clipping. Not a physical-device performance test. |
| Solo launch configuration | Normal Practice start returned HTTP 201 with `shieldMk2: true` in both response and stored run configuration. The two-minute HUD and controls rendered. |

**Graphics limit:** the test browser reported `GL_RENDERER = Disabled` and “Error creating WebGL context.” The 3D battlefield was not visually certified and the Practice match was not completed. No renderer workaround or unsupported gameplay-performance claim is included.

**Fault-injection limit:** the acknowledgement test verifies a committed server write followed by a client-fetch response failure, not real TCP packet loss, radio interruptions, or server crash durability.

The test browser context was closed before account cleanup; all generated app rows were then deleted and counts verified zero. No other account or global market was reset. The one accepted purchase retained its real shared-stock effect: iron 99→98, demand +2→+4, revision 2→3. The earlier +20 iron at UTC rollover was normal daily-event activation, not a test reset.

Screenshot references: `90jbzh` installed upgrades; `hcgby1` reload persistence; `wb7y26` discounted travel; `hmn3l6` committed-write pending acknowledgement; `6bv322` capacity rejection; `duofop`/`8izgo6` phone-width layout; `j5ighz` WebGL-limited Practice HUD.

## Certification limits

These are development checks, not a production release certificate. Physical Android/iPhone performance, real-human online matches, production authentication/schema rollout, multi-process load, and real-network interruption testing retain their existing status. A client-fetch acknowledgement fault, if verified below, is not actual packet-loss evidence.
