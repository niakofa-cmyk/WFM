---
name: Orbital scaling and wire protocol
description: Safe adoption rules for large-world coordinates, network transport, and client recovery.
---

Use integer chunk coordinates with bounded local offsets for large Orbital
world positions. Treat this as a precision foundation, not proof of streaming,
shared travel, or persistent sector generation.

Keep current multiplayer protocols until there is a measured need to change
them. A binary transport must be separately versioned, capability-gated,
strictly validated, backward compatible during rollout, and benchmarked against
the actual JSON path under representative load and impairment.

Client-side replay caches and recovered inputs never restore server authority,
combat outcomes, or rewards. Rejoin from a fresh authenticated server snapshot
under the active mode's reconnect policy.

**Owner direction:** build live shared Orbital flight for nearby authenticated
pilots and persistent AI fleets on the existing authenticated WFM socket.
Identity, faction, position, movement, target locks, damage, and results remain
server-owned. Exact pilot poses are restricted to authorized nearby session
participants; public presence remains aggregate-only.

**Why:** the owner provided server-movement, binary transport, lock-on, delta,
and tracer proposals as the foundation for visible open-universe free flight.

**How to apply:** follow
`docs/infinite-war/SHARED-FLIGHT-WIRE-PROTOCOL-AND-WEAPON-TELEMETRY.md`. Keep
the supplied examples as references, not executable designs: do not trust
client identity/coordinates, add hard-coded secrets or a second unauthenticated
socket, or replace Orbital physics. Establish an authenticated server snapshot
baseline before binary deltas, lock-on, or weapon-tracer replication.

**Why:** the supplied scaling examples proposed `Math.fround` as a blanket
determinism guarantee, an in-place binary protocol replacement, and local
telemetry writes into agent memory. Those approaches risk cross-runtime drift,
client incompatibility, privacy exposure, and forged recovery claims.

**How to apply:** follow
`docs/infinite-war/ORBITAL-SCALE-PROTOCOL-RECOVERY-REDESIGN.md`; require
simulation replay, protocol compatibility, failure recovery, and staged
multi-pilot evidence before enabling any network or authority change.
Treat
`docs/infinite-war/DISTRIBUTED-MULTIPLAYER-MESH-REFERENCE.md` and its preserved
source proposal as architectural references, not copy-paste implementations.

**Owner decision:** use a dedicated Railway Redis service in WFM staging for
live cross-instance coordination, and the existing WFM PostgreSQL database for
durable universe checkpoints and recovery. Keep Production untouched until the
staging proof passes; do not use another project's Redis or expose a public
Redis endpoint.

**Why:** the owner approved a persistent universe spanning locations, socket
instances, and restarts, while keeping live transport separate from durable
world truth.

**How to apply:** Redis coordinates live session ownership, messages, and
presence; PostgreSQL stores versioned checkpoints/events and idempotent
settlement. Use fenced single-writer leases per spatial shard, preserve bounded
interest visibility, and verify failover/restart recovery before any
Production rollout. Local fake-transport tests are useful coverage, but they
are not proof against the Railway staging services.

Lease expiry must be enforced locally before simulation advances, independently
of Redis promise completion. A lease read is not a renewal; a late response or
pending checkpoint load must not revive an owner after authority is lost.

**Why:** Redis clients can queue or delay commands during disconnection, so a
renewal-error handler alone does not guarantee that stale simulation stops.

**How to apply:** keep conservative confirmed lease deadlines, bound transport
queues, invalidate asynchronous session initialization on ownership loss, and
test stalled renewals as well as explicit failures.

Two authenticated sockets on the same public hostname do not prove that two
different socket replicas participated.

**Why:** a load balancer may place both pilots on the same ingress even when
multiple replicas are healthy; reciprocal actor visibility alone cannot
distinguish local routing from Redis routing.

**How to apply:** compare server-issued ephemeral ingress and owner identities
and the ownership fence after authenticated joins. Keep raw identifiers in
test-process memory and publish only hashes or equality checks; do not expose
credentials, host addresses, account identities, or exact pilot poses.
