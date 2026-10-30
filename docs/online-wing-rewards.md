# 5v5 Online Wing credit policy

## Launch rules

Online Wing awards gameplay credits only after the socket server observes a
terminal match result and commits the profile update and ledger event in one
database transaction.

Reward eligibility is a server-owned match property, not a client choice. The
current room-code flow creates private rooms; private, Practice, and test rooms
are never reward-eligible. The server defaults a room to `private` and ignores
client-provided mode fields. The opt-in competitive queue is the only current
path that creates a `competitive` match: it requires ten distinct authenticated
human pilots, assigns them to balanced teams, and starts the match on the
server. The queue is disabled unless `WFM_COMPETITIVE_QUEUE_ENABLED` is exactly
`"true"` on the socket service and `VITE_WFM_COMPETITIVE_QUEUE_ENABLED` is
exactly `"true"` in the frontend build.

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
- A private room is no-reward even if it happens to contain authenticated human
  pilots on both teams.

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

The socket process also requires `WFM_WING_REWARDS_ENABLED` to be exactly
`"true"` and a database URL before it loads the reward settlement module. An
absent, misspelled, or differently cased value disables awards. Queue enablement
and reward enablement are separate: the competitive mode is server-assigned by
the queue, while the reward flag and database gate settlement. Keep reward
enablement off until the queue, schema, and ledger checks are ready.

The current queue, like the existing rooms, is in memory on one socket process.
It groups only connections served by that process; it is not a shared,
multi-replica matchmaking service and does not survive a restart. Confirm the
staging socket's replica/routing behavior before enabling the queue there. A
shared queue and cross-process match routing have not been implemented.

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

The local reference test proves that private/practice/test inputs cause no
transaction and that the runtime enable flag is exact-match and database-gated.
It is not evidence of live staging schema state, runtime variable configuration,
or a live reward/duplicate claim.
