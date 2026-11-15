# Faction population balance and allied AI escorts

## Owner's new design reference

The complete November 9, 2026 owner upload is at
[`attached_assets/Pasted-To-achieve-a-highly-dynamic-self-balancing-ecosystem-in_1794204985018.txt`](../../attached_assets/Pasted-To-achieve-a-highly-dynamic-self-balancing-ecosystem-in_1794204985018.txt).
It proposes a server-owned, population-aware balance for persistent roaming
fleets: when Accord pilots make up 60% of active humans, aim for roughly 80% of
AI force slots to be opposing USSF and 20% to be same-faction Accord support.
Mirror those factions when USSF pilots are the majority. AI escorts should help
in ordinary open-universe encounters, not put the player into a separate mode.

This is an adjustable starting direction, not a guaranteed per-encounter ratio.
The repository now contains a cross-owner active-seat census and a staging-only,
transactional persistent-patrol balancer. The writer remains disabled by
default; implementation and local tests do not certify the deployed staging
runtime or a measured converged share.

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
- In shared Redis mode, socket owners publish hashed account identities with
  faction and the exact current user-seat lease. Redis validates the lease on
  write and read, deduplicates an account across workers, and expires stale
  seats. The result contains faction counts only; it does not contain account
  IDs or locations.
- PostgreSQL now has a global population controller and append-only applied
  epoch receipts. A row lock serializes the writer; deterministic baseline
  patrols are inserted idempotently and actual ship rosters are counted.
- Persistent reserve formations are added with epoch-scoped IDs on connected
  routes. Existing patrols are never overwritten and destroyed hulls are never
  restored to manipulate a ratio.
- These are implementation capabilities in source. No live Redis Lua execution,
  staging database migration, feature-flag activation, multi-replica population
  count, or measured fleet-share convergence has yet been certified.
- The current combat actor model has pilot and patrol actors. A persistent
  same-faction strategic patrol is not yet a dedicated in-combat AI escort
  diverted to a human wing. Human participants, their rewards and AI actors
  need distinct identities and settlement rules.

## Balancing target to evaluate

Use **active rostered ship hulls**, not fleet records or arbitrary actors, when
measuring the faction share. Fleets contain different numbers of ships, and a
live encounter lease must not count the same persistent hull twice. The
implemented writer reads durable patrol rosters and adds new formations under a
single global PostgreSQL epoch lock; it does not remove or repair casualties.

The requested example provides a concrete, adjustable starting target. Let `a`
be the share of distinct authenticated, actively flying pilots whose saved
faction is Accord. The default hostile-share ceiling is 80%. The staging writer
can tune it through `ORBITAL_FREE_FLIGHT_MAX_HOSTILE_SHARE` from 50% to 90%,
retaining a friendly AI floor:

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
default 20–80% bounds prevent either faction from disappearing. This is an initial
calibration, **not a finding that an 80/20 target is fun, safe or correct in all
regions**; evaluate encounter completion, player damage, waiting distance,
disconnects and match/server load before widening it. Avoid changing force
ratios on every heartbeat: the source implementation uses an eight-point
actual-hull-share deadband, a five-minute minimum epoch interval, an eight-hull
per-epoch cap and a 128-hull extra-world cap. It adds only and does not despawn
fleets, so the actual share may trail or differ from the target.

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

## Safe implementation and rollout status

1. **Implemented in source:** the shared socket census uses hashed account
   identities, faction and the current Redis user-seat lease. It deduplicates
   reconnects/owner handoffs, expires stale seats, and fails closed above the
   configured population bound. Tests use an in-memory Redis contract fake;
   they do not execute Lua against a live Redis service.
2. **Implemented in source:** pure target planning, bounded additive hull
   planning, deterministic epoch-scoped 2–4 ship reserve formations, whole-route
   baseline materialization, and a durable PostgreSQL epoch/audit transaction
   are covered by targeted tests and typechecks.
3. **Implemented but disabled by default:** the writer requires an explicit
   staging-only flag, shared Redis transport, staging marker, database, and
   pre-existing schema. Additive migration 0008 is tracked; no runtime DDL is
   performed. Production is rejected by the feature gate.
4. **Not certified against live services:** apply the migration in staging,
   verify the actual Redis Lua scripts, then test two replicas, both pilot
   majorities, lease handoff, stale disconnects, concurrent epochs,
   encounter reservations, casualty preservation and restart recovery. Measure
   actual hull-share convergence before calling the system live or
   self-balancing.
5. **Still separate future work:** a same-faction strategic patrol is not
   automatically dispatched as an in-combat AI escort. Any escort deployment
   must use connected route movement, combat capacity, durable deduplication and
   existing server settlement rather than teleporting an AI beside the pilot.

See [Global AI Population Census and Durable Epochs](GLOBAL-AI-POPULATION-EPOCHS.md)
for the implementation contract, safety caps and explicit staging gates. The
[Orbital fleet population and encounter director](ORBITAL-FLEET-POPULATION-AND-ENCOUNTER-DIRECTOR.md)
still describes the encounter behavior boundary.
