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

The initial **tunable example** is derived from the live human faction split.
If `a` is the share of fresh active pilots who are Accord:

```text
desired USSF AI share = clamp(0.50 + 3 * (a - 0.50), 0.20, 0.80)
desired Accord AI share = 1 - desired USSF AI share
```

An empty population uses a neutral 50/50 target. Thus 6 Accord pilots of 10
produce an 80% USSF / 20% Accord AI target: **the USSF ships are enemy ships,
and the Accord ships are friendly support**. Reverse the factions for a USSF
majority. The percentage is adjustable; 80/20 is a starting balance example,
not a fixed requirement or a command to respawn destroyed ships. Apply updates
only with hysteresis and a bounded cadence.

“Enemy” and “friendly” are relative to the pilot or group in an encounter.
With a mixed-faction universe, a single global 80/20 percentage cannot make the
80% hostile to every user simultaneously. The global policy may follow the
verified active pilot mix, while local encounter composition should account
for the factions actually participating there. Never create duplicate AI ships
per client to make each user's view appear faction-relative.

Regional encounter intensity is a separate threat-budget policy. Initial
proposal: safe/core 0.5–0.8× human threat; established routes 0.8–1.0×;
contested frontier 1.0–1.5×; deep space usually 1.0–1.5×, with rare 2.0–2.5×
events. These are design bounds, not live difficulty settings. Threat must be
measured by ship strength, not raw hull count.

## Repository evidence and safeguards

The persistent named-location network seeds one USSF and one Accord patrol per
eligible location. Each starts with two to four ships and advances on a
connected route from saved timestamps. In explicitly enabled shared staging,
the population controller may also materialize the complete named route graph
and add epoch-scoped reserve formations. Destroyed ships are never restored to
force a ratio. The free-flight runtime separately caps pilot seats, actors,
nearby snapshots, projectiles, and simultaneous encounters. A fleet record is
not a ship count, and a leased hull must never be counted twice.

Population input must come only from fresh authenticated server flight seats.
Deduplicate accounts, exclude disconnected pilots and spectators, and derive
faction from validated admission. Preserve real casualties and active
reservations. Use durable, revision-checked population epochs before changing
persistent rosters. Never spawn hostiles beside a pilot or teleport a friendly
escort into a battle; route an available reserve toward the real encounter.

The shared-flight runtime uses a fenced owner per spatial session when Redis is
configured. Its Redis census now deduplicates active authenticated pilot seats
across owners by validating hashed identities against current seat leases. The
durable population controller serializes additions with a PostgreSQL epoch lock.

## Implemented foundation

- `universe-population-policy.ts` contains deterministic, pure helpers to count
  distinct fresh active pilot seats, calculate a configurable faction mix,
  classify encounter-relative enemy and friendly factions, calculate regional
  threat envelopes, and apply cooldown/hysteresis checks.
- At combat runtime, the pilot group's server-authorized faction determines the
  friendly AI side; the persistent enemy patrol must be the opposite faction.
  This prevents a globally mixed population from reversing the local
  enemy/friendly meaning. The 80/20 shares are not yet used to change hull
  counts.
- The shared Redis census emits only aggregate faction counts. It omits account
  IDs, region names, coordinates and fleet identities. Per-owner telemetry
  remains separate from the global count.
- Tests cover duplicate/reconnected accounts, stale/disconnected/spectator
  seats, conflicting faction samples, both encounter faction orientations,
  adjustable shares, the 6/10 example and its mirror, regional threat
  envelopes, bounded reinforcement planning, connected deterministic reserves,
  census lease handoff/staleness, staging-only configuration and a local
  PostgreSQL concurrency/casualty integration case.

## Implemented but not live-certified

The population writer remains **off by default** and can only be enabled in the
explicit shared WFM staging runtime after schema readiness. The new tables are
represented in Drizzle schema and additive migration 0008; no staging migration
or environment toggle was changed here. Local tests prove the policy and a
temporary PostgreSQL transaction path, but the census Lua has not been executed
against live Redis and no live two-replica convergence test has been run.

The writer only adds up to eight hulls per five-minute epoch, with an
eight-percentage-point deadband and a 128-hull cap above the deterministic
baseline. It never deletes/repairs a roster to chase the ratio. Thus 80/20 is a
bounded target, not an exact guarantee. Deep-space region identity exists in
Orbital sector addressing, but the persistent patrol directory is still tied
to named world locations. Existing friendly defenders are bounded AI actors;
their dispatch is not yet a route-backed persistent reserve. The opening-combat
verification still does not certify that a friendly defender pushes through
shield recovery to hull damage and enemy destruction.

## Next safe increments

1. Apply migration 0008 through the staging-only schema workflow; validate
   production remains untouched and the explicit writer flag remains off until
   approval.
2. Execute the census Lua against staging Redis; verify two replicas, account
   handoff, stale leases and disconnect behavior.
3. Run concurrent staging epochs, verify one monotonic receipt, unique reserve
   IDs, casualty preservation, restart recovery and measured faction hull
   counts. Do not claim a live 80/20 state until observed.
4. Extend the strategic graph with versioned deterministic deep-space regions
   and valid approach routes, without storing a database row for every
   possible coordinate.
5. Dispatch friendly reserve actors through those routes into the existing
   Orbital encounter, under faction, capacity, attribution, reward, reconnect,
   and mobile-performance tests.
6. Stage small controlled traffic changes; compare target mix to measured hull
   mix and track contact intervals, combat conversion, survival, bandwidth,
   server time, and Android frame performance before increasing population.

See [Global AI Population Census and Durable Epochs](GLOBAL-AI-POPULATION-EPOCHS.md)
for the exact table, lease, cadence and activation contract.

The full owner upload is retained with the project attachments as
`Pasted-Worked-for-35s-Yes-I-agree-WFM-needs-a-deliberate-enemy_1794429844862.txt`.
