# Continuous-flight combat, evasive movement, and repeat encounters

## Direction

Use the same Orbital universe flight for the opening battle, exploration,
subsequent fleet interceptions, and overlapping fleet battles. Retain Three.js
as the main renderer and native WebGL2 as a companion path. An encounter is a
server-owned engagement inside that flight, not a teleport to another arena.

Pilots must be able to defeat a fleet, keep their surviving ship and tallies,
continue traveling, and meet additional fleets. Multiple nearby fleets may
join the same ongoing action, subject to existing server capacity and leases.
Do not manufacture enemies, weaken enemy weapon damage, or award test victories
to make an automated demonstration succeed.

## Combat and defensive behavior

- Retain the native primary weapon and missile catalogs, hull statistics,
  projectile collisions, server attribution, and settlement contracts.
- Hybrid right-thumb control retains physical lateral/vertical thrust, normalized
  diagonals, and eight-way directional bursts. Bursts retain energy costs,
  cooldowns, life checks, collisions, and independent primary fire.
- Shared-flight shield recovery follows Combat Lab's three shield points per
  second after two seconds without damage, capped at the hull's shield maximum.
  This applies equally to pilots and enemy actors. It is not a permanent upgrade
  or a source of immunity.
- Holding primary fire and missiles together between battles must not reject
  primary-fire admission. The server suppresses premature missile intent until
  a genuine combat contract exists. Missile-only requests retain their existing
  out-of-combat rejection and acquisition requirements.
- This work does not claim that shared-flight special abilities, ammunition
  resupply, countermeasures, or all training capabilities have been migrated.
  Do not present those as usable without their negotiated authoritative paths.

## Persistent traffic refresh

Occupied sessions periodically resolve the durable patrol directory without
requiring a reconnect. Recheck the pilot's saved location before applying an
asynchronous response. Allow one outstanding refresh per session; do not fan out
additional reads while it is pending.

Reconcile idle arrivals and departures while retaining existing actor state.
Active and settling fleets keep their actors and combat leases. An already
destroyed, settled fleet cannot be recreated by a stale directory response.
Refresh failure retains flight and existing contracts, logs an unavailable
directory, and never substitutes sample enemies. Reservation remains the
authority for starting a fight.

## Local verification versus staging certification

The native regression scenario uses normal ship/weapon values, authenticated-seat
runtime interfaces, ordinary analog inputs, and real simulated projectiles.
It checks one enemy fleet's destruction, its receipt and kill credit calculation,
surviving flight afterward, and admission to two later simultaneous fleet
engagements without another universe join. Compact test-only spawn distances
make the scenario deterministic; they are not a deployment configuration.

The scenario does **not** establish survival or victory against both later
fleets. The stress run can destroy the pilot after those encounters begin.
Its settlement adapter is an in-memory test double: credit calculation is not
proof of a durable database balance, and actor snapshots do not certify visible
3D meshes in an authenticated browser.

Additional regressions cover live-battle diagonal dodge plus firing, shield
recovery rate/delay, mixed primary/missile admission, pending refresh bounds,
saved-location changes during a lookup, and arriving/departing fleets.

Staging acceptance still requires the exact reviewed deployment, fresh
authenticated pilots, visible enemy meshes, accepted maneuver and fire intent,
actual hits and destruction, durable exactly-once rewards, continued movement,
another fleet interception, and overlapping engagements. Preserve the existing
staging/Production gates and original test-account ship selections.
