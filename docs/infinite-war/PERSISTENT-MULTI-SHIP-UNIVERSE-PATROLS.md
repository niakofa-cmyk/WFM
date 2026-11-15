# Persistent multi-ship patrols in the Infinite War universe

## Direction and source documents

This feature implements the strategic patrol and faction-actor foundation from the two
owner-provided references, preserved verbatim at:

- [`references/redesign/MASTER-AI-GAME-DEVELOPMENT-DIRECTIVE-2026-11-07-SOURCE.txt`](references/redesign/MASTER-AI-GAME-DEVELOPMENT-DIRECTIVE-2026-11-07-SOURCE.txt)
- [`references/redesign/INFINITE-OPEN-UNIVERSE-2026-11-07-SOURCE.txt`](references/redesign/INFINITE-OPEN-UNIVERSE-2026-11-07-SOURCE.txt)

The universe remains the game world, and patrols are persistent faction actors
with routes and purposes. The patrol layer is strategic world simulation; it is
not another combat engine, a set of disconnected missions, or evidence that a
live multiplayer battle is occurring.

The owner requires the next stage to show server-patrolling fleets and
authenticated pilots as live 3D ships in the same free-flight universe. See
[Live 3D patrols and pilot presence](LIVE-3D-FREE-FLIGHT-PRESENCE-AND-PATROLS.md)
for that target and the precise gap between it and the bounded operation below.
The newer faction-mix and same-faction AI-assistance proposal is assessed in
[Faction population and AI escort direction](FACTION-POPULATION-AND-AI-ESCORT-DIRECTION.md);
the population balancer and dedicated live escort role are not implemented by
the existing fixed seeded network.

## Implemented slice

- The strategic patrol network is derived from the server-owned world travel
  graph, so an AI fleet cannot route through an unconnected destination.
- Deterministic USSF and Accord formations are lazily materialized for the
  current region and its directly connected regions. Each faction receives one
  route-roaming formation and one local route-security formation.
- Each formation contains two to four existing WFM hull identities and a stable
  server-assigned callsign. The roaming formation follows a connected
  two-location route; the route-security formation stays assigned to its
  location so a route departure cannot leave a newly entered area empty.
- The fleet roster, current region, route index, last movement time, and
  concurrency revision are stored in the additive `universe_patrols` table.
- Strategic waypoints advance every two minutes from the saved timestamp. The
  simulation is query-driven and uses a database revision compare-and-set;
  it does not rely on a process-local timer or require every API worker to stay
  alive.
- `GET /world/patrols` is authenticated and derives the region from the
  player's stored world position. It accepts no client location or fleet state.
- The Galaxy screen shows the server-reported patrols in the current region and
  their planned route. An unavailable sensor response is explicit; the UI does
  not invent a fleet count.
- Both local and roaming persistent formations load as server-owned 3D actors in
  continuous Orbital free flight. A route-security assignment remains at its
  strategic location while its ships move on local server AI waypoints. Destroyed
  hulls are not respawned by a directory refresh.

The network currently covers the nine named world locations already present in
the world route graph. Records materialize only around a visited location;
this keeps persistence sparse and lets the graph expand without pre-creating
fleets for every possible future sector.

## Authority and safety boundaries

- Patrol composition, identity, location, objectives, and movement are
  server-owned and persist across API restarts once their region is materialized.
- The UI labels these as strategic AI contacts, not human pilots or active
  matches.
- This strategic directory layer does not itself spawn flight actors or apply
  hull damage. Separately, an authenticated Orbital V2 `universe-patrol`
  operation can reserve the persistent patrol, spawn its server-owned ships,
  validate combat, attribute kills/assists, settle eligible rewards, and remove
  destroyed ships from the saved patrol roster. That operation is explicitly
  requested from free flight and runs in its own server sector session; it does
  not inherit or validate the local free-flight pose.
- Neither the strategic directory nor the bounded patrol operation currently
  writes faction-wide reputation, knowledge, or territory changes.
- Existing Wing matchmaking/rewards, private rooms, AI-fill rooms, local Orbital
  training, and the separate V2 Pale Beacons patrol are unchanged.
- Story evidence and narrative consequences remain player-scoped and must be
  recovered or settled through their existing server-authoritative contracts.
  A patrol objective alone does not reveal a hidden story fact.

## Verification boundary and remaining gates

1. Verify the deployed staging build from two authenticated devices: both pilots
   must receive the same server-owned patrol actors in the same canonical
   location, and the local route-security formations must remain visible after
   the roaming formations advance.
2. Verify live patrol engagement, friendly assistance, casualty persistence,
   cross-replica handoff, and restart recovery in staging. The route directory
   and unit tests are not a substitute for this device test.
3. Expand beyond the current named route graph through versioned sector IDs,
   sparse world-state storage, interest management, and measured mobile/network
   budgets. Do not claim an infinite simulation merely because the generator is
   deterministic.
4. Keep Production untouched until staging multi-device evidence, database
   recovery, privacy and rollback checks pass and separate approval is given.

## Rollback

The patrol panel can be hidden and the authenticated endpoint disabled without
changing world travel, operation directory, or combat code. The new database
table is additive and contains no player-private account data. Do not drop it
as part of a rollback; leave stored rows intact so the feature can be re-enabled
without losing strategic state.
