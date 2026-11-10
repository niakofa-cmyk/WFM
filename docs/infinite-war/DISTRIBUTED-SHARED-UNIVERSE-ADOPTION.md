# Distributed shared-universe adoption

## Preserved proposals

Read in full and preserved verbatim:

- [Shared synchronization architecture](references/DISTRIBUTED-SHARED-UNIVERSE-SYNCHRONIZATION-SOURCE.txt)
- [Scale audit and binary optimization](references/HORIZONTAL-SCALE-AND-BINARY-OPTIMIZATION-SOURCE.txt)
- [Cluster rollout and plasma trails](references/DYNAMIC-CLUSTER-AND-PLASMA-THRUSTERS-SOURCE.txt)

These are design proposals, not evidence that services were provisioned,
deployed or certified. Their latency, allocation, bandwidth and frame-rate
figures are unmeasured here.

## Adopted implementation

Retain the existing 3D Orbital simulation, authenticated socket, Redis-fenced
single-owner spatial sessions and PostgreSQL versioned checkpoints. Do not add
a second broker/physics loop. Shared state must include XYZ/quaternion movement,
combat, contributions and recovery—not just XY and a heading.

`ORBITAL_FREE_FLIGHT_REQUIRE_PERSISTENCE=1` now makes a socket process refuse to
start if shared mode is not selected. Shared mode validates database-backed
flight admission, the staging-only rollout boundary, and Redis configuration
before connection or schema initialization. Errors never echo endpoint values.
Transport readiness reports whether persistence was explicitly required.
Redis connection and checkpoint initialization failures remain fatal: there is
no silent fallback to isolated worlds.

## Staging activation contract

Use the existing dedicated WFM staging Redis and PostgreSQL, never another
project's broker. On the staging **socket service**, configure:

- `ORBITAL_FREE_FLIGHT_ENABLED=true`
- `ORBITAL_FREE_FLIGHT_SHARED=1`
- `ORBITAL_FREE_FLIGHT_REQUIRE_PERSISTENCE=1`
- `WFM_FREE_FLIGHT_SHARED_ENV=staging`
- Private `REDIS_URL` and the existing staging database connection, through
  the secure service configuration.

Retain the repository's socket start command (`dist/socket.mjs`), service
configuration, origin policy and authentication. Do not replace them with the
proposal's API entrypoint, hard-coded ports or fabricated telemetry routes.
Checkpoint schema initialization already belongs to shared-runtime startup;
do not create a competing pilot ledger that loses health, projectiles or
encounter state.

This change does not provision Redis or change environment settings. Development
was found without a configured `REDIS_URL` secret and remains explicitly local.
Production remains untouched. Real cluster activation still requires secure
configuration and staging deployment.

## Staging preparation inspection — 2026-11-10

The connected Railway inventory confirmed a dedicated Redis service and
PostgreSQL in WFM staging, with the socket service configured for two replicas.
All three report successful deployments in the same region. Redis has a mounted
data volume, no public domain and no public TCP proxy. The socket retains the
existing socket build/start commands and `/healthz` probe.

The socket service lists the Redis, database, shared-mode and staging-marker
configuration keys. Values were not retrieved. An exact-deployment startup-log
query returned no matching transport-readiness record, so this inspection does
not newly confirm runtime connectivity or checkpoint writes.

Only `ORBITAL_FREE_FLIGHT_REQUIRE_PERSISTENCE=1` was prepared as a **staged**
socket-service change. Nothing was applied or redeployed; existing credentials
were not replaced. Deploy the reviewed code and explicitly commit this staged
change before treating the new safeguard as active.

## Runtime configuration evidence

The socket's `/healthz` response now includes a safe `freeFlight` object:

- `enabled`
- `transport`: `disabled`, `process-local`, or `redis-fenced-shards`
- `checkpointStoreConfigured`
- `persistenceRequired`
- `persistentRuntimeConfigured`

These fields are derived from the runtime's actual constructor dependencies,
not blindly copied from environment flags. The runtime constructor rejects
required persistence without admission, the shared transport and checkpoints,
even if invoked without the usual environment entrypoint.

Health configuration is not a live dependency probe or battle certification.
Do not infer that Redis is reachable at this instant, that a checkpoint was
just committed, or that cross-instance combat passed merely from these fields.
The endpoint exposes no credentials, pilot identities, poses or session keys.

## Rejected unsafe substitutions

- The proposed typed-array physics kernel is two-dimensional and omits
  quaternion orientation, energy, collision and weapon contracts.
- The 17-byte binary example is syntactically incomplete, loses the third
  dimension/velocity and does not preserve the current protocol. Keep the
  versioned existing wire path until compatibility and measured load justify
  a negotiated replacement.
- A global actor broadcast exposes distant pilot positions and bypasses
  spatial interest boundaries; preserve per-session authorized routing.
- A `curl` request with a fabricated signature does not test authenticated
  weapons, failover or settlement. A grep for a pilot ID cannot certify recovery.
- Do not claim zero drift from periodic snapshots: a crash may lose time since
  the last committed checkpoint. Measure the actual recovery interval.
- Plasma trails are presentation only. The supplied example lacks disposal,
  quaternion-based exhaust placement, frame-time independence and rebasing.
  Add them only within the existing renderer's bounded effects lifecycle,
  without creating another universe or changing combat authority.

## Verification gates

Run the shared-runtime regression tests for cross-instance routing, higher-fence
owner replacement, restored session identity, duplicate-seat exclusion,
location isolation and stalled-lease rejection. Their in-memory bus/checkpoint
fixtures validate logic, not Railway connectivity.

For real staging proof, connect two authenticated pilots to distinct ingress
replicas, compare server-issued routing identities, fight shared enemies, then
restart the owner. Verify restoration and idempotent settlement from server
records. Never manufacture enemy destruction or bypass authentication.

See [living universe foundation](LIVING-OPEN-ORBITAL-UNIVERSE-FOUNDATION.md) and
[persistent-universe evidence](PERSISTENT-UNIVERSE-VERIFICATION.md).
