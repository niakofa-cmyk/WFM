# Distributed Multiplayer Mesh Reference

## Source

The supplied proposal is preserved verbatim at
[`references/DISTRIBUTED-PERSISTENCE-CROSS-INSTANCE-MESH-SOURCE.txt`](references/DISTRIBUTED-PERSISTENCE-CROSS-INSTANCE-MESH-SOURCE.txt).
It contains two related example designs. Treat both as architectural input, not
as production-ready code.

## Direction for WFM

WFM remains one persistent universe, partitioned into canonical spatial
sessions so the server can bound simulation and visibility. Nearby pilots in
the same session can share flight and encounters; a session identifier is a
shard address, not a second universe.

- **Redis is the live coordination layer.** It assigns a renewable, fenced
  owner to each spatial session and relays authenticated commands and
  server-generated snapshots between socket instances. Only the current lease
  owner simulates that session.
- **PostgreSQL is the durable recovery layer.** It stores versioned session
  checkpoints and existing durable world/progression records. Redis Pub/Sub is
  not a permanent event log or checkpoint store.
- **The existing authenticated socket remains the game boundary.** The client
  sends validated input; it does not select its account identity, authoritative
  location, faction, damage, or result. The server derives session routing from
  saved world state.
- **Fencing and idempotency remain mandatory.** A former owner cannot keep
  simulating or settle rewards after lease loss. Checkpoint writes are guarded
  by the fencing token and increasing sequence; reward settlement remains
  server-owned and idempotent.
- **Spatial privacy stays bounded.** Exact pilot positions and actor snapshots
  are disclosed only to authorized nearby session participants. A global
  presence registry must not become a way to enumerate or reveal every pilot.

## What the proposal contributes

The useful direction is to move cross-instance coordination out of process-local
memory, keep durable recovery in PostgreSQL, and validate the design with
independent socket owners, reconnects, and restart tests. A private Redis
service in the same staging region is appropriate for that work.

The current implementation follows that direction with the shared free-flight
runtime, Redis-backed fenced ownership and routing, and a versioned PostgreSQL
checkpoint table. Its local tests use independent runtime instances and a
shared test transport/store. That is useful coverage, but it does not by itself
prove Railway behavior.

## Examples not adopted

Do not copy the uploaded snippets literally:

- Do not add the proposed HTTP telemetry endpoint or accept client-supplied
  pilot IDs, factions, coordinates, health, credits, ticks, or signatures as
  authoritative state.
- Do not use the hard-coded signing token, plaintext credential assembly,
  public Redis endpoint, or localhost/default credential fallback shown in the
  examples. Staging uses Railway's private Redis reference; Production remains
  untouched.
- Do not broadcast all pilots through one global channel or enumerate a
  universe-wide exact-position registry. Route only to authorized spatial
  sessions and their bounded interest sets.
- Do not create the proposed `pilot_operational_ledger` or duplicate existing
  progression/world tables. The versioned free-flight checkpoint schema is the
  recovery record for runtime state.
- Do not claim zero drift or zero data loss after a process crash. Recovery
  resumes from the most recent durable checkpoint; an abrupt failure can lose
  state newer than that checkpoint. Graceful disconnect and shutdown flushes
  reduce that window.
- Do not treat `Math.fround` as a cross-runtime determinism guarantee. Continue
  using the game's deterministic math and replay validation rules.
- Do not perform PostgreSQL writes synchronously on every simulation tick.
  Keep checkpoints bounded and off the hot simulation path; measure database
  load and recovery staleness before changing the current one-second active
  checkpoint cadence.

## Staging rollout and proof boundary

The code has passed the workspace typecheck, tests, and build, and the focused
free-flight recovery suite passed. Railway staging has a dedicated private
Redis service. The socket source was connected to the updated branch and the
shared-mode variables were applied only to the WFM staging environment.

The initial shared-runtime Railway deployment is healthy and two socket
replicas are configured. Structured startup attributes confirm
`redis-fenced-shards` and `checkpointStore: true`; the JSON log fields appear in
Railway attributes rather than the message text. This is startup evidence only.
Two authenticated pilots on separate replicas, cross-replica encounter
assistance, and recovery after a real Railway process restart are **not yet
certified**. No Production service or database was changed.

The review also added a fail-closed local lease deadline. Pending Redis commands
cannot keep an expired owner simulating, late renewal responses cannot revive
it, and delayed checkpoint loads cannot recreate an abandoned session. Offline
Redis command queuing is disabled and the command queue is bounded. All 260 API
tests, the API typecheck, and the backend build passed after these changes.
These safety changes require their own staging rollout confirmation.

Before calling this a persistent distributed universe, verify in staging:

1. The socket deployment becomes healthy and reports the Redis-fenced transport
   as ready, without exposing connection strings or secret values.
2. Two authenticated pilots connect through separate socket replicas to the
   same canonical location and observe the same server-issued session and
   nearby actors.
3. Inputs, target state, and encounter results remain server-authoritative
   across replicas; duplicate settlement is rejected.
4. A controlled owner restart restores the latest valid PostgreSQL checkpoint
   under a newer fencing token without duplicating pilots, encounters, or
   rewards.
5. Different spatial sessions remain isolated while still belonging to the
   same durable WFM universe.

Until these checks pass, report local implementation evidence separately from
staging verification. Keep the shared runtime disabled in Production.
