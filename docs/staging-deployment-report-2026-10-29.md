# Staging deployment report reference — 2026-10-29

## Source and scope

This document preserves the owner-supplied report
`Pasted--WFM-staging-deployment-report-PR-5-merged-successfully_1793288072603.txt`
as a project reference and records a separate read-only Railway metadata check.
The supplied report says PR #5 merged at
`970f35daa255f0c21ba5e850d5eba90f56ecb2b7`, the API database schema push
reported “Changes applied,” API `/api/readyz` passed, socket `/healthz` passed,
and staging services were online.

## Independently confirmed Railway metadata

At the latest read-only check on 2026-10-29, Railway reported the frontend, API,
and socket services on the staging environment at commit
`970f35daa255f0c21ba5e850d5eba90f56ecb2b7`, branch `staging`; their current
deployments were all `SUCCESS`. Postgres was online, all listed services were
online, and the environment had no pending changes.

The same environment status response also counted five recent deployment
failures across three application services. Those failures were not current
deployments—the latest deployments listed above were successful—but their
individual causes were not inspected in this check. Do not summarize this as a
clean history or as zero recent failures.

The report's schema-push and health-check statements remain owner-supplied
deployment evidence. The available Railway connection provides service and
deployment metadata but no safe SQL query operation, so this check did not
independently inspect enum labels, table/index state, or reward-ledger rows.
No database URL or other secret value was read.

## Reward-configuration correction

The supplied report says rewards were disabled because
`WFM_WING_REWARDS_ENABLED` was absent. The workspace source inspected for this
update did not check that variable: before the local safety patch, the socket
bootstrap loaded reward settlement when `DATABASE_URL` was present. Therefore,
absence of an enable variable was not sufficient evidence that rewards were
disabled by that source.

The Railway deployment commit is not available in this checkout's Git object
database, so the running socket source at that SHA could not be independently
compared with the local source. Treat live staging reward enablement as
**unverified** and do not run another reward-eligible match until the safety
patch below is deployed and checked.

The local, uncommitted safety patch:

- makes room-code matches default to `private`;
- ignores client-supplied match-mode fields;
- rejects private, Practice, and test rooms before any reward-store transaction;
- requires the exact `WFM_WING_REWARDS_ENABLED="true"` value and a database
  connection before loading reward settlement; and
- requires a trusted server-side competitive-room resolver before a room can
  be reward-eligible. The current socket bootstrap does not configure such a
  resolver, so current room-code matches remain ineligible.

This local patch has not been committed, pushed, or deployed. The change does
not enable rewards or establish live ledger correctness.

## Current release evidence

| Check | Status |
| --- | --- |
| Latest staging frontend/API/socket deployment | **PASS** — Railway metadata shows the same staging commit and successful current deployments |
| Postgres online and no pending Railway changes | **PASS** — status metadata only |
| Recent deployment history | **REVIEW** — five failures reported across three services; causes not inspected |
| Staging schema/enum/index verification | **PENDING** — no SQL query was run |
| Live reward balance/event/duplicate evidence | **PENDING** — ledger not inspected in this check |
| Interrupted/expired claim denial | **PENDING** — no live claim was submitted |
| Production settings or deployment | **UNCHANGED** |

## Safest next sequence

1. Deploy and smoke-test the local safety patch on staging only after its source
   is reviewed and pushed through the staging branch workflow.
2. Use an owner-authorized, read-only staging database query to verify the
   `wing_reward` enum and existing unique idempotency index. Keep the database
   target explicitly scoped to staging and return no player identifiers.
3. Keep rewards disabled until a real server-owned competitive queue exists.
   Current room-code matches must remain no-reward.
4. If/when that queue exists, run the approved staging-only exact-once and
   replay checks, capture sanitized before/after balances and event counts, and
   independently verify interrupted/expired denial without creating a reward.
5. Keep the separate Production Clerk and release-promotion gates unchanged.

