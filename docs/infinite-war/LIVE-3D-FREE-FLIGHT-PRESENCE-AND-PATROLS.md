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

## Verified baseline and current prototype — 2026-11-08

The current implementation is a useful foundation, not this completed feature:

- Persistent USSF/Accord strategic patrols are stored on the server and project
  as 3D ship models into the local free-flight renderer.
- The projection uses server-reported strategic traffic and a bounded sensor
  radius. It is presentation only; the free-flight pilot pose and movement are
  still local.
- A separate authenticated Orbital V2 `universe-patrol` sector operation can
  reserve a persistent fleet, simulate combat on the server, persist confirmed
  kills/assists and casualties, and settle eligible rewards. The pilot explicitly
  requests this operation; it does not inherit the visible contact's current
  free-flight position.
- The existing universe-presence API stores a server-derived destination and
  returns aggregate counts. It does not distribute pilot ship poses. The
  aggregate API remains separate from the new authenticated short-lived pose
  stream.
- A feature-gated JSON prototype now broadcasts server-simulated pilot and
  temporary patrol actors to authenticated pilots in the same coarse
  destination session. The current Arena projects those ships in the existing
  Three.js scene; it does not open a parallel game universe.
- The player's rendered ship still follows local prediction; authoritative pose
  reconciliation is not yet implemented. The prototype's sessions are not 3D
  spatial cells, and its four patrols are not the persistent route fleet system.
- Weapon actions are rejected in this slice. No kill attribution, rewards,
  reputation, territory changes, or live-battle settlement are connected.

See [persistent patrol implementation and limits](PERSISTENT-MULTI-SHIP-UNIVERSE-PATROLS.md)
and [the server encounter contract](PRIMARY-ORBITAL-BOOT-AND-ENCOUNTER-CONTRACT.md).
The transport and weapon-event implementation sequence is in
[Shared-flight wire protocol and weapon telemetry](SHARED-FLIGHT-WIRE-PROTOCOL-AND-WEAPON-TELEMETRY.md).
The source audit, rollout gates, and exact prototype limits are in
[Free-flight roaming runtime audit and implementation](FREE-FLIGHT-ROAMING-RUNTIME-AUDIT-AND-IMPLEMENTATION.md).

## Implementation and acceptance gates

1. Replace coarse destination sessions with server-owned bounded spatial cells
   and feed existing persistent patrol route records into those interest groups.
2. Reconcile predicted local pilot movement to the server pose; validate
   reconnect, snapshot interpolation, and renderer parity through both supported
   paths.
3. Run encounter detection and escalation from server simulation state. Preserve
   the current encounter rules and use existing result/settlement contracts
   rather than trusting client proximity or opening a parallel battle instance.
4. End combat back into the same authoritative universe session, applying
   casualties and recording kill/assist history without resetting flight
   position or silently advancing a hidden local simulation.
5. Verify both renderer paths against identical snapshots and control outcomes.
   Test both factions, multiple devices, latency, reconnect, stale presence,
   privacy, duplicate settlement, and rollback on staging before rollout.

Do not call the universe continuously shared or describe human ships as live
until authenticated multi-client flight has been observed in the same region
and the server owns the positions and encounter results.
