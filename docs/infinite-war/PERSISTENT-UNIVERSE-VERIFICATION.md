# Persistent Universe Verification

## Current result

**The distributed implementation is locally verified; staging proof is pending.**
The server now has Redis-fenced spatial-session ownership and routing, plus
versioned PostgreSQL flight checkpoints. Local tests exercise independent runtime
instances and owner recovery with a shared test transport/store. They do not
prove behavior against Railway Redis, the staging PostgreSQL database, or two
authenticated staging pilots. Production remains untouched.

## What the implementation establishes

- Authenticated admission reads the pilot's saved world location and derives a
  location-specific session key (`mars:<location>`). The client cannot choose
  that key.
- Redis assigns one fenced owner to each location session. Other socket
  instances relay authenticated commands and snapshots to that owner rather
  than simulating a duplicate copy.
- A Redis-backed per-pilot seat prevents one account from occupying two
  location sessions at once. A replacement owner can take over the same shard
  only with a newer fencing token.
- Nearby actor snapshots are scoped to one session and its bounded spatial
  interest radius. Pilots admitted to different location keys do not share
  exact actor snapshots or live encounters; each remains a spatial shard of the
  same WFM world, not a separate universe.
- PostgreSQL stores versioned session checkpoints, including pilot pose,
  projectiles, target state, patrol actors, and encounter attribution. Writes
  are guarded by the Redis fencing token and a monotonic checkpoint sequence.
  Active-session checkpoints run once per second; disconnect and shutdown flush
  the latest state. Stored snapshots are limited to 4 MiB.
- The checkpoint table is created and checked only when the shared runtime is
  explicitly enabled with the staging environment marker. Production does not
  enable this path.
- Player location/progression, persistent patrol routes, encounter reservations,
  and settled outcomes continue to use the existing PostgreSQL-backed records.

## Verification matrix

| Requirement | Current status | Evidence needed for a pass |
| --- | --- | --- |
| Shared location session | **Local adapter test passes** | Two independent runtime wrappers receive the same server session and nearby actors through a shared fake Redis transport; repeat with authenticated staging clients. |
| Travel across locations in one universe | **Partial** | Different canonical locations remain isolated shards and the same account cannot hold two seats; seamless coordinate/world-state travel still needs staging verification. |
| Multiple socket processes | **Local adapter test passes** | Independent runtimes relay through the test transport; verify on two Railway socket replicas with real Redis. |
| Process restart | **Local recovery test passes** | A replacement owner restores the same session identity and pilot actor from the test checkpoint store; repeat against Railway Redis and staging PostgreSQL. |
| Durable world consequences | **Partial** | Verify persisted patrol movement, casualties, player location, and settlement from a fresh staging process and database query. |

## Checks run

The focused free-flight and encounter suite passed **22/22 tests** with:

```sh
pnpm --filter @workspace/api-server exec tsx --test \
  src/socket/free-flight-shared-runtime.test.ts \
  src/socket/free-flight-continuity.test.ts \
  src/game/exploration-encounter.test.ts
```

These tests use independent runtime instances and a shared in-memory test
transport/checkpoint store. They verify shared shard snapshots, isolated
locations, single-flight initialization, one active account seat, and state
restoration after the owner is replaced. They do not connect to actual Railway
services or authenticate browser pilots.

The read-only staging infrastructure check found one socket replica and no
named Redis, Valkey, NATS, RabbitMQ, Kafka, or Pub/Sub service. Therefore a live
multi-instance staging proof cannot be run on the current topology. This check
did not change Railway resources or deployments.

### Staging transport provisioning

A dedicated Railway Redis service is provisioned in the WFM staging
environment, in the socket service's `us-east4-eqdc4a` region. Railway reports
it online with one replica, no public domain, no TCP proxy, and no pending
changes. The socket service still has one replica and the shared transport has
not yet been enabled in Railway staging. Until the staged deployment and
two-pilot/restart checks pass, the persistence matrix remains **not verified in
staging**.

## Required architecture before claiming success

1. Keep one WFM world identity and canonical spatial addresses; location IDs
   are regions/shards, not separate universes. A shard's `sessionInstanceId`
   must not be mistaken for a global universe identifier.
2. Assign one authoritative writer per spatial shard with a renewable,
   fenced lease. A stale process must not continue simulating or settling after
   losing ownership.
3. Keep Redis as the real-time transport for inputs, snapshots, and ownership
   changes between socket processes; do not substitute unbenchmarked per-tick
   PostgreSQL polling.
4. Persist durable world events and periodic versioned checkpoints in the
   existing database workflow. Keep high-frequency simulation in memory on the
   current shard owner; checkpoint cadence and replay bounds must be measured.
5. Define restart behavior for active encounters: restore all authoritative
   state from a compatible checkpoint, or settle/release the encounter as an
   idempotent no-reward interruption. Never infer a kill, reward, or pilot pose
   from client state.
6. Gate rollout on isolated tests with two independent runtime processes and a
   staging restart. Keep Production disabled until the same tests pass against
   the intended staging topology and database.

## Required proof sequence

1. Join two authenticated pilots on separate runtime instances in the same
   region; compare server-issued universe, shard, session, actor, and tick
   identities.
2. Move one pilot through a validated location transition. Confirm canonical
   coordinates and server-owned world state remain continuous while nearby
   interest sets change correctly.
3. Move a patrol and settle a controlled encounter; query the authoritative
   records from a fresh application process and verify the same revision,
   casualties, and idempotent result.
4. Restart the active shard owner during a controlled encounter. Confirm the
   replacement owner acquires a newer fenced lease and either restores the
   exact checkpoint or applies the documented interruption policy once.
5. Attempt to submit the same result from both the old and new owners. Confirm
   only one settlement/reward is committed.
6. Repeat with the clients connected to different socket processes and with
   pilots in different regions. Verify that only intended nearby actors are
   disclosed and that distant locations remain part of the same durable
   universe without being incorrectly placed in one local combat session.

Until this sequence passes, the verified statement is limited to
**same-location, same-process shared flight**. This document records the current
boundary; it does not claim that the distributed persistence layer has been
implemented.
