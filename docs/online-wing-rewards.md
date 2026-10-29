# 5v5 Online Wing credit policy

## Launch rules

Online Wing awards gameplay credits only after the socket server observes a
terminal match result and commits the profile update and ledger event in one
database transaction.

| Player outcome | Credits |
| --- | ---: |
| Win | 30 |
| Draw | 15 |
| Loss | 10 |

To qualify:

- The completed room must have an authenticated, meaningfully participating
  human pilot on each opposing team.
- Each rewarded pilot must be connected when the match completes, have at
  least 60 seconds of server-counted active time, and provide at least 120
  accepted non-neutral control inputs.
- Active time accrues only while the pilot is connected and has recently
  provided a non-neutral input.
- An account can receive at most five Wing rewards per UTC day.
- Solo-versus-AI rooms, inactive pilots, disconnected pilots at completion,
  interrupted rooms, and matches without a verified terminal result do not
  receive rewards.
- Practice and local endurance remain no-reward modes.

These are gameplay credits only. They are not purchased currency or real-money
rewards.

## Integrity and account behavior

The socket server derives the result from its authoritative simulation and
derives each player's result from their server-assigned team. Clients cannot
submit an outcome, player ID, reward amount, or match ID.

The socket server creates a fresh UUID for each match. Every credited player
gets one `wing_reward` event in the existing `progression_events` ledger with
the key `wing:<match UUID>`. The existing unique `(user_id, idempotency_key)`
index prevents a replay from crediting the same player twice. The profile
balance/revision update and ledger insert share a database transaction.

A normal socket restart before a terminal match result retains the existing
interrupted-match behavior and does not create reward events. A result is sent
to each player through a private socket message; another player's balance is
never included in the broadcast match snapshot. A reconnecting participant can
receive their own already-settled result while the in-memory room remains
available.

## Deployment and database prerequisite

The WFM database package currently uses `drizzle-kit push`; this repository has
no checked-in WFM SQL migration runner. The schema adds the enum label
`wing_reward`, so the staging database schema must be synchronized before
staging reward code is deployed. Use the existing command only with an
explicitly scoped staging `DATABASE_URL`:

```sh
pnpm --filter @workspace/db run push
```

Do not run that command with Production context. Before a live staging test,
verify in Railway's non-secret variable-reference metadata that
`wfm-socket-staging`'s `DATABASE_URL` points to the same isolated staging
database used by `wfm-api-staging`. Variable-name presence alone does not prove
the target database.

The socket service fails closed for rewards if `DATABASE_URL` is missing or a
reward transaction cannot be confirmed; multiplayer still works, but the
debrief says that no reward was confirmed. Database errors are retried with
bounded backoff and safe, identifier-free logs.

## Verification required before release

Automated checks should cover team-specific win/loss outcomes, draws, the
participation threshold, opposing-human requirement, daily cap, duplicate
settlement, unauthorized/incomplete matches, and restart interruption.

Before enabling this policy outside staging, verify a two-account completed
staging match against the isolated staging ledger. Capture sanitized before
and after balances, one `wing_reward` event per qualifying account, and a
replay attempt that does not change either balance or event count. Keep the
Production Clerk and game release gates independent; this document does not
authorize Production settings changes or deployment.
