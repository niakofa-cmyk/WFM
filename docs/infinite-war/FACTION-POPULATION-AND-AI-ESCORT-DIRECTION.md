# Faction population balance and allied AI escorts

## Owner's new design reference

The complete November 9, 2026 owner upload is at
[`attached_assets/Pasted-To-achieve-a-highly-dynamic-self-balancing-ecosystem-in_1794204985018.txt`](../../attached_assets/Pasted-To-achieve-a-highly-dynamic-self-balancing-ecosystem-in_1794204985018.txt).
It proposes a server-owned, population-aware balance for persistent roaming
fleets: when Accord pilots make up 60% of active humans, aim for roughly 80% of
AI force slots to be opposing USSF and 20% to be same-faction Accord support.
Mirror those factions when USSF pilots are the majority. AI escorts should help
in ordinary open-universe encounters, not put the player into a separate mode.

This is a **design direction**, not an implemented live balancer or a green
light to copy the sample code. A deterministic pure policy now calculates the
requested target and tests its edge cases, but it is deliberately not wired to
fleet spawning until population data is global and durable.

## Repository facts checked

- `createSeededPatrols` makes one deterministic 2–4-ship USSF roster and one
  deterministic 2–4-ship Accord roster for each named location with neighbors.
  Stable patrol IDs are inserted with conflict protection, routes use connected
  world-graph locations, and fleet positions advance every two minutes from
  persistent timestamps using database revision checks.
- `getUniversePatrolDirectory` derives the pilot's location from saved world
  state. `resolveUniversePatrolEncounters` exposes only alive, non-empty patrols
  of the opposing faction at that location. This is not a globally adaptive
  fleet-population controller.
- Encounter reservation locks participant world-state rows and the chosen
  persistent patrol, verifies that the authenticated participants share its
  saved location, and gives the roster one active lease. Confirmed casualties
  remove ships from that persistent roster; the current code does not restore a
  wiped roster to meet a population target.
- Shared-flight interest snapshots are bounded. The runtime currently caps
  pilots per session, actors per session, nearby actors and concurrent
  encounters; the server, rather than a population-balancer sample, must enforce
  these safety and performance limits.
- The socket runtime now exposes and periodically logs anonymized
  **single-owner-process** counts for connected pilots by faction, live AI
  hulls, support actors, encounters and actors. It omits account IDs, region
  keys and coordinates. It is telemetry for measurement, not a whole-universe
  population count.
- Neither the database patrol directory nor the encounter contract provides a
  durable, cross-worker count of distinct, actively flying humans by faction.
  The general operation/presence summaries must not be mistaken for such a
  count until their identity, freshness, deployment scope and semantics have
  been checked.
- The current combat actor model has pilot and patrol actors. A persistent
  same-faction strategic patrol is not yet a dedicated in-combat AI escort
  diverted to a human wing. Human participants, their rewards and AI actors
  need distinct identities and settlement rules.

## Balancing target to evaluate

Use **active rostered ship hulls**, not fleet records or arbitrary actors, when
measuring the faction share. Fleets contain different numbers of ships, and a
live encounter lease must not count the same persistent hull twice. The current
`universe-population-policy.ts` implements the pure target calculation and
fresh-account filtering; it does not yet calculate the durable hull share or
change any population.

The requested example provides a concrete, adjustable starting target. Let `a`
be the share of distinct authenticated, actively flying pilots whose saved
faction is Accord. The default hostile-share ceiling is 80%, but policy callers
can tune it between 50% and 100%:

```text
if no authenticated human pilots are active:
    desiredEnemyUssfShare = 0.50
otherwise:
    desiredEnemyUssfShare = clamp(0.50 + 3 * (a - 0.50),
                                  1 - maximumHostileShare, maximumHostileShare)
desiredFriendlyAccordShare = 1 - desiredEnemyUssfShare
```

This deliberately maps 6 of 10 active pilots to Accord → an 80% USSF / 20%
Accord-AI target, as requested. At a 50/50 pilot split it returns 50/50; the
mirrored 4-of-10 Accord split returns a 20% USSF / 80% Accord-AI target. The
The default 20–80% bounds prevent either faction from disappearing. This is an initial
calibration, **not a finding that an 80/20 target is fun, safe or correct in all
regions**; evaluate encounter completion, player damage, waiting distance,
disconnects and match/server load before widening it. Avoid changing force
ratios on every heartbeat: smooth small changes, apply hysteresis and a bounded
update cadence, then show that the achieved regional hull share tracks its
target without repeated spawning and despawning.

Count only distinct authenticated pilots with a fresh, server-confirmed flight
seat. Exclude dormant accounts, stale/disconnected sessions, spectators, public
presence totals and duplicate windows for one account. The player's faction
comes from server-validated saved loadout/admission, not from a client-supplied
ratio, local renderer or claimed squad count. Keep a global trend for the
requested universe-wide force mix separate from regional pressure: a global
majority must not leave a minority pilot's current region with no opposing
contact or remove the available session's actor cap.

## Friendly AI participation

Yes—same-faction AI wing support belongs in the shared universe, alongside
human assistance. It should be a separate, bounded reserve of server-owned
escort actors, dispatched under the authenticated pilot's actual faction and
existing encounter rules. Route an available patrol or reserve toward the
encounter using server coordinates and deterministic pathing; do not materialize
a fleet at arbitrary random coordinates or teleport it beside a player.

An AI escort must render from the same versioned Orbital snapshots, obey hull,
damage, targeting, friendliness, spatial-interest and actor-count rules, and
withdraw or resume its mission when the battle resolves. It must never be
counted as a human pilot, occupy a human seat, manufacture player attendance,
receive an account reward, or claim a human kill/assist. Keep its NPC contribution
and any player damage credit governed by explicit existing server settlement
rules. Do not invent an assist-credit amount, bounty or reputation award.

## Why the supplied sample is not production-ready

- A `Math.random()` rebuild on each recount relocates and duplicates fleets
  instead of updating durable strategic actors. Its recurring synthetic IDs can
  collide across workers; positions and sector targets are not connected to the
  game's persisted named-route graph.
- A constant 100-fleet pool ignores ship roster size, per-session actor bounds,
  locality, leases, database uniqueness, concurrent workers, NPC completion
  state, and the mobile/network simulation budget.
- An in-memory active-pilot map is not a cross-process source of truth. A
  dashboard presence count is not necessarily a count of active, authenticated
  flight pilots. No balancer may trust client totals.
- Mutating an array of fleets does not save the rosters or stream actor
  lifecycles. The renderer must display validated server actors; updating a
  Three.js instance matrix alone cannot create an authoritative patrol.
- The escort sample does not consult its `playerFaction` argument when choosing
  a friendly faction. Its range check and fleet-ID marker are insufficient to
  prevent repeated dispatch, wrong-sector assists or a second spawn during a
  concurrent encounter.
- A changing renderer bundle size claim in an unrelated source prompt does not
  test population balancing. Keep the standalone bundle-size guard at its
  current threshold.

## Safe implementation sequence

1. **Partially implemented—instrument, do not spawn:** the socket owner emits
   anonymized process-local counts. Still needed: durable per-region roster
   counts, leases, casualties, empty fleets and encounter outcomes; a
   cross-owner active-seat census; and proof of reconnect/owner-handoff
   deduplication. Keep counters private and never expose player identities or
   hidden fleet coordinates publicly.
2. **Implemented as pure policy tests:** covers no pilots; 5/5; 6/4; 4/6;
   capped extremes; duplicate, stale, offline, spectator and conflicting
    seats; faction-relative encounter sides; adjustable hostile share; regional
    threat envelopes; and cooldown/hysteresis without writing the database.
    Still needed: cross-region and actor-cap fixtures connected to a global
    census.
3. **Balance persistent patrols idempotently:** use stable IDs and persisted
   bounded population epochs or another explicit durable generation key; protect
   shared counts and updates with database transactions/revision checks.
   Rebalance only at a bounded cadence. Preserve a battle reservation and never
   erase a real casualty to satisfy a target. Apply global target mix and
   regional minimum hostile-contact constraints separately.
4. **Add escorts as a distinct NPC role:** reuse the authoritative Orbital flight
   and battle runtime, not a parallel renderer, co-op operation, queue or user
   account. Revalidate faction, active encounter, location, capacity and
   candidate patrol availability before committing a dispatch. Deduplicate the
   dispatch durably. Protect both human and AI casualty/settlement attribution.
5. **Not yet staged:** test both player-faction majorities,
   connected locations, empty/no-pilot regions, simultaneous API workers,
   restart/reconnect, encounter reservation conflicts, rewards, rollback and
   Android/network budgets. Compare the requested 80/20 target with measured
   actual hull shares before calling the population self-balancing.

Do not launch broad fleet spawning or schema changes from this reference alone.
Preserve the current deterministic patrol network, shared-flight authority,
human reward rules and compatibility rollback until these gates pass.

See [Orbital fleet population and encounter director](ORBITAL-FLEET-POPULATION-AND-ENCOUNTER-DIRECTOR.md)
for the current implementation boundary and next safe increments.
