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
- A deterministic USSF and Accord multi-ship formation is lazily materialized
  for the current region and its directly connected regions.
- Each formation contains two to four existing WFM hull identities, a stable
  server-assigned callsign, one strategic objective, and a two-node route.
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

## Remaining implementation gates

1. Connect nearby strategic contacts directly to a shared, server-authoritative
   free-flight session. The current client-side range prompt is not proof of
   location and must not authorize combat or rewards.
2. Carry the bounded patrol operation's validated actors, damage, kill/assist
   attribution, and reconnect-safe identity into that shared flight without
   creating a second simulation or losing the existing rollback path.
3. Extend the existing result settlement to continuous free-flight outcomes and
   define any faction-wide consequences separately. Keep the current bounded
   operation's idempotency and reward gates; do not modify Wing rewards.
4. Expand beyond the current named route graph through versioned sector IDs,
   sparse world-state storage, interest management, and measured mobile/network
   budgets. Do not claim an infinite simulation merely because the generator is
   deterministic.
5. Verify API concurrency, database persistence after restart, both factions,
   route behavior, privacy, staging multi-device flight, and rollback before
   widening the runtime rollout.

## Rollback

The patrol panel can be hidden and the authenticated endpoint disabled without
changing world travel, operation directory, or combat code. The new database
table is additive and contains no player-private account data. Do not drop it
as part of a rollback; leave stored rows intact so the feature can be re-enabled
without losing strategic state.
