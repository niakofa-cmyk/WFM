# Orbital fleet population and encounter director

## Direction

The open universe should feel inhabited and contested without making every
region the same combat arena. Keep four concerns separate:

1. **Fleet density:** persistent hulls, routes, missions, casualties, and
   replenishment.
2. **Encounter frequency:** how often a pilot sees or crosses an active force.
3. **Engagement intensity:** how many ships and how much threat actually join
   one battle.
4. **Orbital simulation:** server-owned movement, weapons, damage, snapshots,
   and validated settlement for actors selected by the directors.

The directors choose and schedule activity; Orbital remains the only live
simulation. Do not add another renderer, combat runtime, mission launch, or
client-authoritative population count.

## Population balance rule

The requested initial AI hull mix is derived from the live human faction split.
If `a` is the share of fresh active pilots who are Accord:

```text
desired USSF AI share = clamp(0.50 + 3 * (a - 0.50), 0.20, 0.80)
desired Accord AI share = 1 - desired USSF AI share
```

An empty population uses a neutral 50/50 target. Thus 6 Accord pilots of 10
produce an 80% USSF / 20% Accord AI target; the reverse split mirrors it. This
is a tuning target for active AI hulls, not a command to respawn destroyed
ships. Apply updates only with hysteresis and a bounded cadence.

Regional encounter intensity is a separate threat-budget policy. Initial
proposal: safe/core 0.5–0.8× human threat; established routes 0.8–1.0×;
contested frontier 1.0–1.5×; deep space usually 1.0–1.5×, with rare 2.0–2.5×
events. These are design bounds, not live difficulty settings. Threat must be
measured by ship strength, not raw hull count.

## Repository evidence and safeguards

The persistent named-location network currently seeds one USSF and one Accord
patrol per eligible location. Each starts with two to four ships and advances
on a connected route from saved timestamps. Destroyed ships are removed; the
roster is not replenished to force a ratio. The free-flight runtime separately
caps pilot seats, actors, nearby snapshots, projectiles, and simultaneous
encounters. A fleet record is not a ship count, and a leased hull must never be
counted twice.

Population input must come only from fresh authenticated server flight seats.
Deduplicate accounts, exclude disconnected pilots and spectators, and derive
faction from validated admission. Preserve real casualties and active
reservations. Use durable, revision-checked population epochs before changing
persistent rosters. Never spawn hostiles beside a pilot or teleport a friendly
escort into a battle; route an available reserve toward the real encounter.

The current shared-flight runtime uses a fenced owner per spatial session when
the Redis transport is configured. It does not yet provide a globally
aggregated, cross-owner active-faction census or a durable global fleet
population ledger. Per-process counts are useful telemetry, not a global
population source.

## Implemented foundation

- `universe-population-policy.ts` contains deterministic, pure helpers to count
  distinct fresh active pilot seats, calculate the proposed 20–80% faction
  mix, calculate regional threat envelopes, and apply cooldown/hysteresis
  checks. The code does not mutate any fleet.
- The free-flight runtime exposes and emits anonymized per-owner telemetry at
  a bounded interval when the socket service is enabled. It includes active
  pilot faction counts, active AI hull counts, friendly support actors,
  active encounters, and total actors. It intentionally omits user IDs, region
  names, coordinates, and fleet identities.
- Tests cover duplicate/reconnected accounts, stale/disconnected/spectator
  seats, conflicting faction samples, the requested 6/10 example and its
  mirror, bounds, regional threat envelopes, and hysteresis.

## Explicitly not enabled yet

Telemetry is scoped to one process; it cannot establish the whole-universe
faction ratio across socket owners. The pure policy is not wired to spawning.
The database does not yet have a durable population epoch or transactional
replenishment contract. Deep-space region identity exists in Orbital sector
addressing, but the persistent patrol directory is still tied to named world
locations. Existing friendly defenders are bounded AI actors, but their
dispatch is not yet a route-backed persistent reserve. The opening-combat
verification currently fails to prove that a friendly defender pushes through
shield recovery to hull damage and enemy destruction. Do not describe that
behavior as certified or increase live fleet density until these gaps are
closed.

## Next safe increments

1. Aggregate active seat counts across fenced owners without exposing player
   identities or exact positions; verify reconnect and owner handoff do not
   double count.
2. Measure actual live hulls, active leases, casualties, empty rosters, and
   encounter outcomes from durable sources.
3. Add transactional, idempotent population epochs and gradual replenishment
   that never repairs casualties or races an encounter lease.
4. Extend the strategic graph with versioned deterministic deep-space regions
   and valid approach routes, without storing a database row for every
   possible coordinate.
5. Dispatch friendly reserve actors through those routes into the existing
   Orbital encounter, under faction, capacity, attribution, reward, reconnect,
   and mobile-performance tests.
6. Stage small controlled traffic changes; compare target mix to measured hull
   mix and track contact intervals, combat conversion, survival, bandwidth,
   server time, and Android frame performance before increasing population.

The full owner upload is retained with the project attachments as
`Pasted-Worked-for-35s-Yes-I-agree-WFM-needs-a-deliberate-enemy_1794429844862.txt`.
