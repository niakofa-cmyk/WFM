# Live 3D patrols and pilot presence in Orbital free flight

## Owner direction

The infinite open Orbital universe must show both opposing faction fleets and
other pilots as live 3D spacecraft during free flight. Players should encounter
moving ships in the same world they navigate, not only see strategic map
contacts, destination counts, or a separate battle launch screen.

This is one shared game world. Three.js is the primary renderer for the main
universe and native Orbital WebGL2 remains a supported companion renderer. Both
must present the same Orbital simulation state; a renderer must not create its
own universe, flight physics, identity, progression, or combat authority.

## Required encounter experience

- USSF pilots encounter Accord fleets; Accord pilots encounter USSF fleets.
- AI formations and authenticated player ships travel, patrol, maneuver, and
  appear as 3D ship actors in the active free-flight region.
- Detection and faction behavior use authoritative position, speed, heading,
  sensors, transponder, faction/reputation, restricted territory, weapon state,
  target intent, and the fleet's current operation.
- A close approach can escalate into a live encounter without sending the pilot
  to a disconnected menu or a different simulation. Investigation, challenge,
  warning, interception, reinforcements, and retreat remain faction-driven.
- After combat, free flight continues from the server-confirmed result position.
  Confirmed kills, assists, destroyed fleet members, and eligible rewards are
  recorded once; aborted encounters do not pay.
- The player faction, fleet roster, and encounter history must remain consistent
  across reconnects and subsequent visits.

## Authority and visibility boundary

The server owns player movement and pose, patrol movement and intent, fleet
composition, encounter transitions, damage, kill/assist attribution, casualties,
result history, and reward settlement. Clients render bounded/interpolated
snapshots and send validated control intent; client-reported coordinates,
damage, kills, and amounts never authorize combat or rewards.

Public destination directories continue to expose only anonymous aggregate
presence and public operation state. Exact nearby pilot poses may be sent only
to authenticated participants in the same authorized spatial interest group,
with bounded range, short-lived snapshots, and disconnect expiry. They must not
become a public location lookup, identity feed, or permanent coordinate record.
Do not fabricate pilot ships when no server presence exists.

## Current implementation and verification boundary — 2026-11-12

- Persistent USSF/Accord patrol rosters now load as server-owned 3D actors in
  the authenticated Orbital free-flight runtime. The renderer projects the same
  versioned snapshots; it does not create another universe or decide combat.
- Each materialized location seeds a route-roaming fleet and a
  route-security fleet for each faction. The local fleet prevents a location
  from appearing empty solely because its roaming formation is between
  waypoints. Both continue tactical server AI movement. A casualty remains
  removed; directory refresh does not heal or restore it.
- The shared free-flight runtime owns pilot and patrol movement, target state,
  projectiles, damage, encounter transitions, and result settlement. Nearby
  same-faction human pilots and bounded persistent AI patrols can join the same
  active encounter. AI support receives no human kill credit or player reward.
- Patrol selection and settlement revalidate saved world location, persistent
  fleet identity, current roster and encounter reservation on the server.
  Clients cannot fabricate contacts or authorize damage from their local
  distance estimate.
- Redis-backed session ownership and checkpoints are enabled in WFM staging.
  Staging telemetry currently confirms the writer is running, but its latest
  captured aggregate had no authenticated pilots. Therefore two-device
  co-location, visible enemy fleets, and in-battle assistance are not yet
  certified against the live staging runtime. The owner plans to run that
  device check.
- The staged free-flight population balancer previously emitted stale-census
  results when comparing absolute timestamps across Redis and socket hosts.
  Freshness now uses local receipt time after the Redis-side lease pruning; the
  updated correction must be included in the next successful staging release.

The strategic directory still covers the named nine-location route graph. This
is not evidence of an unbounded infinite map. See
[persistent patrol implementation and limits](PERSISTENT-MULTI-SHIP-UNIVERSE-PATROLS.md)
for the current scope and acceptance gates.

See [persistent patrol implementation and limits](PERSISTENT-MULTI-SHIP-UNIVERSE-PATROLS.md)
and [the server encounter contract](PRIMARY-ORBITAL-BOOT-AND-ENCOUNTER-CONTRACT.md).
The transport and weapon-event implementation sequence is in
[Shared-flight wire protocol and weapon telemetry](SHARED-FLIGHT-WIRE-PROTOCOL-AND-WEAPON-TELEMETRY.md).
The saved landscape combat HUD reference and its remaining combat gates are in
[Free-flight combat HUD and encounter reference](FREE-FLIGHT-COMBAT-HUD-AND-ENCOUNTER-REFERENCE.md).
The source audit, rollout gates, and exact prototype limits are in
[Free-flight roaming runtime audit and implementation](FREE-FLIGHT-ROAMING-RUNTIME-AUDIT-AND-IMPLEMENTATION.md).

## Implementation and acceptance gates

1. Confirm two authenticated pilots on separate staging devices receive the same
   session snapshot and can see the same human ships and persistent patrols.
2. Verify the local patrol and roaming formations appear on both devices, and
   that an encounter, assist, casualties, and continued flight remain consistent
   after a socket-owner handoff.
3. Verify both supported renderer paths against identical snapshots and control
   outcomes. Test both factions, latency, reconnect, stale presence, privacy,
   duplicate settlement, and rollback before any Production rollout.

Do not call the universe continuously shared or describe human ships as live
until authenticated multi-client flight has been observed in the same region
and the server owns the positions and encounter results.
