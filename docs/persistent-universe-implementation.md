# Persistent universe: document implementation and verification

## Reference and security boundaries

The complete 214-line reference was read:
`attached_assets/Pasted-Module-Architecture-Galaxy-Exploration-System-Manages-s_1792537501777.txt`.

Its module architecture is implemented within the existing TypeScript/React/API/database workspace, rather than adding the sample CommonJS singleton. The USSF and Accord remain the game's factions; the illustrative Syndicate and Merchants Guild do not replace them.

The sample's local wallet mutation, globally mutated unlock flags, full client `STATE_SYNC`, no-op backend, and in-memory queue are not trusted persistence mechanisms. Only authenticated, validated server requests may change credits, materials, standing, unlocks, discoveries, and service results.

## Requirement mapping

| Reference requirement | Implementation |
| --- | --- |
| Distinct sectors and activities | Existing six Mars locations plus Outer Fringe Anchorage and Deep Nebula Observatory. Alpha Core includes the original theater. Phobos has market, refinery, refit, hyperdrive, and dispatch; other sites offer salvage, beacon service, medicine delivery, research, or restricted brokerage. |
| Hyperdrive and standing gates | Persistent tiers 1–3. Outer Fringe needs tier 2, standing 10, one clear; Deep Nebula needs tier 3, standing 50, three clears. All are checked server-side for travel. Lock reasons are visible. Return lanes remain open after standing loss. |
| Station amenities | Refinery consumes iron/salt into dust. Materials reduce solo refit credit costs by half; standard credit-only refits remain an alternative at Phobos. Hyperdrive upgrades consume credits, iron, dust, and salt. Refits have a capped level and visible solo hull/shield/damage benefits. |
| Salvage | Surveyed material caches require a logged discovery and can be claimed once per location/UTC cycle, even with new request keys. Salvage yields depend on the event. |
| Dynamic contracts | Existing four story contracts remain. Event dispatches change required goods and payout; frontier faction supply contracts require standing 25. Deliveries consume real inventory and add to actual shared supply. |
| Faction consequences | Standing is clamped to -100..100 and displayed as Hostile/Neutral/Friendly/Allied. Restricted brokerage damages both factions' trust; faction deliveries damage rival standing. Advanced services/markets enforce clearance. Diplomatic restitution offers a paid recovery path even when hostile. |
| Events affect price, supply, risk and opportunities | The existing three daily events now alter actual shared supply once, dispatch rewards and type, salvage yields, frontier fares, and specified hostile-standing exposure. Effects are deterministic and described; no nonexistent combat-risk simulation is claimed. |
| Persistent world changes | Discoveries, location, hyperdrive tier, faction standing, material inventory, dated service ledger, and global supply persist. Transactional event activation cannot apply a daily stock change twice. |
| Real backend synchronization | A generated authenticated `/api/world/services` endpoint validates service, location, cycle, materials, standing, balance, and request identity. The client never submits a world-state replacement. |
| Offline caching | Last acknowledged server snapshots are cached per account for read-only display. Stale/error/paused states are marked NOT LIVE. Cached balances never become authority or locally awarded progression. This is not an installable offline game/PWA or a promise that a cold browser can load without network access. |
| Offline action queue | A durable per-account journal records one outstanding action before sending. Dependent actions are blocked until it is resolved. Requests contain intents and stable idempotency keys, not local credits or reputation. |
| Recovery | Retry on mount, network-online, every 30 seconds, or manually. A 15-second dispatch timeout preserves unknown outcomes. Requests are not removed before a successful acknowledgement or definitive rejection. Stale cycles/prices require renewed user review. Storage failure blocks the mutation. |

## Confirmed trading exploit correction

The prior audit proved that two immediate bulk buy/sell loops could create 1,900 credits.

Trading now uses quantity-aware bid/ask prices that account for each order's price impact and apply a spread. The UI uses exact server-provided bulk totals, not a next-unit quote multiplied by quantity. Buys have a maximum accepted total; sales have a minimum accepted total. Unfavorable quote movement rejects the order without charging it.

Regression coverage includes both trade directions, quantities, supply/demand extremes, daily modifiers, clamp boundaries, and integer rounding. The original live service exploit is tested directly and no longer increases the test account balance.

## Code modules

- `artifacts/api-server/src/game/market-pricing.ts`: price-impact and bid/ask rules.
- `world-event-rules.ts`: daily supply, payout, exposure and fare effects.
- `world-rules.ts`: route gates, return lanes and bounded standing.
- `world-activities.ts`: server-derived activity definitions and availability.
- `world-services.ts`: atomic materials, credits, upgrades, consequences and ledger.
- `world.ts`: personal discoveries, story contracts, routes and assembled world snapshots.
- `artifacts/war-for-mars/src/game/pending-actions.ts`: account-scoped durable request journal.
- `useDurableAction.tsx`: real dispatch, cache freshness, acknowledgement and recovery.
- `GalaxyScreen.tsx`, `UniverseActivities.tsx`, `MarketPanel.tsx`: real, responsive user flows.

## Database rollout

The development schema was updated additively using the existing pnpm/Drizzle setup.
`docs/migrations/universe-services.sql` documents the enum, hyperdrive, supply-activation and range-check changes for independently reviewed environments. Production has not been modified, migrated, or certified.

## Verification

**Tested implementation commit:** `12be116dbb4b0a3249078e110746886cd2c3fccc` on `staging`.
Only documentation changed after that source commit.

Commands executed:

```sh
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run push
pnpm run build
pnpm test
pnpm --filter @workspace/api-server exec tsx --test --test-concurrency=1 \
  src/game/world-services.test.ts src/routes/progression.test.ts
pnpm --filter @workspace/war-for-mars run typecheck
pnpm --filter @workspace/war-for-mars run build
```

The final two frontend commands were rerun against the committed implementation after the query-provider and non-blocking background-refresh changes. Dependencies were unchanged; this is not a new clean-checkout installation certificate.

- Workspace typecheck and all production builds: passed.
- Full automated pass: 39 API tests and 8 client tests, no skips. After adding a mid-transaction rollback regression and strengthening existing service/route assertions, the five affected API tests also passed; total unique test coverage is now 40 API plus 8 client tests.
- Targeted checks cover actual service/database transactions, account isolation, daily deduplication, idempotent lost-response replay, concurrent stock/debit protection, changed-price rejection, supply activation rollback, pending journal durability, and corrupt/unavailable storage.
- Physical Android/iPhone testing, human ten-pilot matches, production auth, deployment restart behavior, and long-duration operations remain outside this change and are not certified.
- This is a deeper persistent between-match journey, not a continuous shared real-time galaxy or a claim that the entire campaign/game is finished.

## Signed-in browser journey

A generated, isolated Clerk test identity used supported programmatic sign-in with overridden login claims. No owner account, production credentials, or production resources were used. The test profile was seeded with 5,000 CR, four clears, tier 1, Accord standing 10, and specified materials; these are fixtures, not evidence of credits earned through combat.

| Checkpoint | Observed result |
| --- | --- |
| Tier gate | Outer Fringe initially unavailable at tier 1. |
| Material refit | Exactly one level, one ledger record, -60 CR, -2 iron/-1 salt/-1 resin. Balance 4,940 CR. |
| Hyperdrive | Tier 2 cost 100 CR and materials. Reload preserved tier 2 and 4,840 CR; Outer Fringe opened. |
| Travel and discovery | Rust Disc trip cost 8 CR; discovery logged once. |
| Daily salvage | +3 iron/+2 salt/+1 dust, +2 Accord standing. Reload preserved materials/discovery and one salvage ledger row; another daily claim was unavailable. |
| Return and market | Return fare 8 CR. One iron purchase at a quoted 73 CR changed credits 4,824→4,751 and iron 8→9. Exactly one transaction was stored. |
| Pending request recovery | An intercepted attempt failed before committing. The journal retained its key; reload automatically retried that same key, committed once, and cleared the journal. |
| Backend world-read outage | Aborting only world GET requests displayed `OFFLINE SNAPSHOT - NOT LIVE` with the acknowledged 4,751 CR. Restoring reads removed the stale banner without inventing progression. |
| Phone-width layout | At 390×844, document/body width remained 390. Materials wrapped and faction labels fit without horizontal overflow. This is browser layout evidence, not physical-device certification. |
| Cleanup | All application rows belonging to the generated test identity were deleted. No other account was reset. The single test purchase's shared iron stock/demand effect was retained: stock 80→79, demand +2, revision +1. |

**Important remaining browser gap:** the interception intended to drop a response *after commit* instead received upstream HTTP 401 before commit. It therefore does **not** certify a committed-but-lost response in the browser. Server/database duplicate replay and discarded-response recovery tests pass, and the browser demonstrated retained-key retry after failure. Do not conflate those observations with the unverified exact scenario.

Authenticated screenshot references from that run:

- `9gpduc`: persisted tier 2, 4,840 CR and open Outer Fringe route.
- `eb5ajl`: salvage complete/unavailable for the UTC cycle.
- `fzho2z`: retained pending market action after interception failure.
- `zm5beh`: explicitly NOT LIVE cached world.
- `d62g76`: live world restored.
- `uaz1pl`, `rkctv5`: station/materials and standings at phone width.

The public landing page also rendered successfully in a separate unsigned screenshot. Existing development-Clerk/WebGPU-environment warnings do not establish production or device readiness. No publication was initiated.
