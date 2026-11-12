# Global AI fleet population census and durable epochs

## Purpose

This implements the adjustable global AI hull-share direction from
[Faction Population and AI Escort Direction](FACTION-POPULATION-AND-AI-ESCORT-DIRECTION.md)
inside the existing persistent patrol network. The example remains an initial
target: when Accord is the larger active human faction, the default target is
80% USSF hostile hulls / 20% Accord friendly hulls; the target mirrors for a
USSF-heavy group. This is a global hull-share target, not a promise that each
individual encounter has those exact percentages.

## Implemented contract

- Shared socket owners publish only each live pilot's SHA-256 identity digest,
  authenticated faction and exact current user-seat lease value to Redis. Raw
  account IDs, locations and coordinates are not sent to the census keys or
  emitted in logs. The digest is pseudonymous, not cryptographic anonymity; the
  Redis records are short-lived and stay private to the server transport.
- The census checks each digest against the existing Redis user-seat lease on
  both write and read. An old owner cannot replace a newer seat, and an account
  contributes at most one faction count. Presence older than 20 seconds is
  removed; a census over 4,096 pilots fails closed instead of returning partial
  numbers.
- Redis timestamps and prunes the census using its own clock. Each successful
  read also records the receiving socket's local time; the epoch freshness guard
  compares that local receipt time rather than comparing absolute Redis and
  socket clocks across hosts.
- The active faction counts are sampled across the shared socket instances. A
  local/process-only runtime cannot activate balancing.
- PostgreSQL holds one `global` controller row. A `FOR UPDATE` transaction
  serializes epochs across replicas, materializes the deterministic baseline
  patrol network idempotently, counts actual roster hulls, and atomically
  inserts reserve patrols, advances the epoch and records an audit receipt.
- Reserve formations have new epoch-scoped IDs and connected routes. Each
  contains 2–4 ships. The balancer only adds underrepresented hulls; it never
  edits old rosters, restores destroyed hulls or despawns a fleet to force a
  percentage.
- Balancing is deliberately slow and bounded: at most one applied epoch per
  five minutes, at most eight added hulls in an epoch, and at most 128 added
  hulls beyond the deterministic baseline. It pauses when the actual hull-share
  gap is below eight percentage points or there are no active human pilots.
- The default maximum hostile share is 80%. The optional
  `ORBITAL_FREE_FLIGHT_MAX_HOSTILE_SHARE` setting accepts 0.50–0.90, preserving
  at least a 10% friendly share. The pure target function remains independently
  testable.

## Activation and safety

The writer is off by default. It may be enabled only with
`ORBITAL_FREE_FLIGHT_POPULATION_BALANCER=1` in the explicitly shared WFM
staging runtime (`NODE_ENV=production`, `WFM_FREE_FLIGHT_SHARED_ENV=staging`,
shared Redis transport, and `DATABASE_URL`). Startup checks that the new tables
already exist; it does not create tables at runtime. The additive schema is
`lib/db/migrations/0008_universe_population_epochs.sql`. Production is not
enabled or changed by this feature.

When the writer is off, shared census refresh still reports aggregate counts
for private operational diagnosis; it does not alter any patrol. Do not expose
the census or hidden patrol positions as a public roster API.

## Verification boundary

Pure policy, reserve identity/route, seat-lease deduplication, stale-seat
rejection, staging-only configuration, and shared-runtime regression tests pass
in the local test harness. Free-flight loads both factions' local persistent
patrols, routes up to two nearby friendly ships into an active battle without
teleporting them, and settles any destroyed friendly ships atomically with the
enemy fleet and reward receipt; see
[Route-Based Friendly Patrol Support](ROUTE-BASED-FRIENDLY-PATROL-SUPPORT.md).
The census tests use an in-memory Redis contract fake; they do not execute the
Lua scripts against a live Redis service. The PostgreSQL epoch and allied-loss
integration test skips unless the explicitly named disposable local database is
configured.

### Staging rollout status — November 12, 2026

The additive schema push completed during the successful WFM staging API
deployment. The staging-only writer flag is enabled, and both socket replicas
are online on the same release. Runtime logs confirm population telemetry and
epoch execution. The last available telemetry before authenticated pilots
joined reported zero active pilots and no loaded sessions; it does not certify
faction-share convergence, visible patrol encounters, or AI assistance. Initial
epoch logs also exposed cross-host clock skew in the freshness guard; the guard
now uses local read-receipt time, and this correction must be confirmed in the
next staging deployment before the two-device test.

Still required after that release: authenticate two pilots on separate devices,
confirm both are routed into the same spatial session, verify both factions are
counted once across socket replicas, exercise one user-seat handoff and stale
disconnect, then verify an encounter and friendly support. Confirm any applied
epoch is serialized once, reserve IDs do not duplicate, casualties are not
restored, and hull counts move only toward the selected target within the
stated caps. Production remains untouched.
