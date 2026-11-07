# Persistent multi-ship patrols in the Infinite War universe

## Direction and source documents

This feature implements the patrol and faction-actor direction from the two
owner-provided references, preserved verbatim at:

- [`references/redesign/MASTER-AI-GAME-DEVELOPMENT-DIRECTIVE-2026-11-07-SOURCE.txt`](references/redesign/MASTER-AI-GAME-DEVELOPMENT-DIRECTIVE-2026-11-07-SOURCE.txt)
- [`references/redesign/INFINITE-OPEN-UNIVERSE-2026-11-07-SOURCE.txt`](references/redesign/INFINITE-OPEN-UNIVERSE-2026-11-07-SOURCE.txt)

The universe remains the game world, and patrols are persistent faction actors
with routes and purposes. The patrol layer is strategic world simulation; it is
not another combat engine, a set of disconnected missions, or evidence that a
live multiplayer battle is occurring.

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
- This slice does not spawn a flight-level enemy, apply hull damage, resolve
  kills or assists, write faction-wide knowledge, or award credits.
- Existing Wing matchmaking/rewards, private rooms, AI-fill rooms, local Orbital
  training, and the separate V2 Pale Beacons patrol are unchanged.
- Story evidence and narrative consequences remain player-scoped and must be
  recovered or settled through their existing server-authoritative contracts.
  A patrol objective alone does not reveal a hidden story fact.

## Remaining implementation gates

1. Connect nearby strategic contacts to server-authoritative Orbital free-flight
   sessions using validated spatial position, sensor range, transponder,
   reputation, weapon state, and territory rules.
2. Promote selected patrol ships into bounded encounter actors with deterministic
   server movement, damage, retreat/reinforcement rules, and reconnect-safe
   encounter identity.
3. Link confirmed destruction and evidence recovery to an explicit exploration
   result contract and idempotent settlement policy. Do not invent rewards or
   modify Wing reward gates as part of that work.
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
