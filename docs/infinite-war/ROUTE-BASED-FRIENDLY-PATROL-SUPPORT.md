# Route-based friendly patrol support

## Gameplay contract

Friendly ships are persistent patrol actors already moving in the pilot's
canonical universe location. When a same-faction battle is active, the nearest
available same-location patrol can answer automatically if it is within the
server sensor/response radius. The ship keeps its actual patrol position and
flies toward the encounter through the normal Orbital flight controls; it is
never cloned or teleported next to the player.

At most two friendly AI patrol ships can support one battle. A patrol already
reserved for another battle, assigned to another encounter, destroyed, or
outside response range cannot be dispatched. If no persistent friendly patrol
is available, the existing single local training defender remains a fallback.
The support ship stays an AI actor, not a human participant, and uses the same
targeting, projectiles, collision, shields, hull damage, and combat simulation
as the other ships.

After the encounter ends, surviving patrol ships resume their regular route.
Destroyed ships from a persistent supporting patrol are recorded separately
from enemy kills and human reward attribution, then removed in the same database
transaction as the enemy patrol outcome and player reward ledger. A duplicate
settlement cannot apply the loss twice or restore the ship.

## Verification

- Socket tests cover visible nearby-patrol dispatch, real projectile contact,
  no synthetic duplicate when a persistent fleet responds, and checkpoint
  recovery of the assigned AI.
- Encounter-contract tests cover friendly patrol casualties without AI kill
  credit, human reward, or account attribution.
- The disposable-local-PostgreSQL test covers atomic removal of enemy and
  friendly losses under one encounter receipt. It skips unless the configured
  database is the explicitly named local test database.
- These checks do not prove Railway staging deployment, live Redis owner
  handoff, two-replica patrol dispatch, or real-device combat. Keep the
  population writer disabled until the staging database, Redis census,
  replica takeover, restart, and casualty checks are complete.
