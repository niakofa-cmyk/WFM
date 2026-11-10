# Persistent Universe Verification

## Current result

**Not verified; the current free-flight runtime does not provide one live,
persistent universe across locations, server instances, and process restarts.**
Do not describe the previous paired-pilot staging test as proof of those
properties. It proved shared flight and same-target locking only while both
pilots were attached to the same location session in one running socket process.

## What the current implementation establishes

- Authenticated admission reads the pilot's saved world location and derives a
  location-specific session key (`mars:<location>`). The client cannot choose
  that key.
- A single `createFreeFlightRuntime` instance owns its sessions in a local
  `Map`. Two socket processes therefore have independent session maps and
  independently generated session instance IDs.
- Nearby actor snapshots are scoped to one session and its bounded spatial
  interest radius. Pilots admitted to different location keys do not share
  those snapshots or a live encounter through this runtime.
- Runtime shutdown interrupts connected clients and clears session state.
  Active actor poses, projectiles, target selection, and in-memory encounter
  simulation are not restored from a durable flight checkpoint.
- Some strategic world state is durable: player location/progression and
  persistent patrol routes, revisions, reservations, and settled outcomes use
  PostgreSQL-backed records. This does not make active free-flight sessions
  durable or shared between processes.

## Verification matrix

| Requirement | Current status | Evidence needed for a pass |
| --- | --- | --- |
| Shared location session | **Pass, same process only** | Two authenticated clients receive the same server session and each other's nearby server-owned actors. |
| Travel across locations in one universe | **Fail / not established** | A pilot transitions between canonical spatial regions without losing global coordinates or durable world identity; other regions retain their independently moving world state. |
| Multiple socket processes | **Fail** | Two separately started runtime processes must expose one authoritative region state, not separate actors, targets, or encounters. |
| Process restart | **Fail** | Restart during flight must restore a versioned checkpoint or resolve the interrupted encounter under an explicit, idempotent recovery rule. No ambiguous result may pay twice. |
| Durable world consequences | **Partial** | Verify persisted patrol movement, encounter casualties, player location, and settlement from a fresh process against the same database. |

## Checks run

The focused API free-flight suite passed **16/16 tests** with:

```sh
pnpm --filter @workspace/api-server exec tsx --test src/socket/free-flight-runtime.test.ts
```

Its location-scope test confirms the current boundary: two pilots admitted to
the same location share a `sessionInstanceId` and nearby-pilot snapshot, while
a pilot admitted to another location receives a different session ID and does
not see those pilots. The suite exercises reconnect within one runtime, but it
does not start a second runtime process or restore a flight checkpoint after a
process restart. Passing this suite is not a pass for the three requested
persistence dimensions.

The read-only staging infrastructure check found one socket replica and no
named Redis, Valkey, NATS, RabbitMQ, Kafka, or Pub/Sub service. Therefore a live
multi-instance staging proof cannot be run on the current topology. This check
did not change Railway resources or deployments.

### Staging transport provisioning

A dedicated Railway Redis service has now been provisioned in the WFM staging
environment, in the socket service's `us-east4-eqdc4a` region. Railway reports
the Redis deployment as successful with one replica, no public domain, no TCP
proxy, and no pending changes. The Redis service is not yet connected to the
WFM socket runtime; no application code, socket replica count, or Production
resource was changed by this provisioning step. The persistence matrix above
therefore remains **not verified**.

## Required architecture before claiming success

1. Give the world a stable universe identity and canonical spatial address;
   location IDs remain destinations or regions, not separate universes.
2. Assign one authoritative writer per spatial shard with a renewable,
   fenced lease. A stale process must not continue simulating or settling after
   losing ownership.
3. Add a shared real-time transport for inputs, snapshots, and ownership changes
   between socket processes. The repository currently has no configured
   Redis/NATS-style runtime transport; do not substitute unbenchmarked
   per-tick PostgreSQL polling.
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
