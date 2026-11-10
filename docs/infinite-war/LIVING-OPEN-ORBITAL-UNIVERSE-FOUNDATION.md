# Living Orbital universe: controlling direction and implementation boundaries

## Governing player experience

Every authenticated pilot enters the same logical, persistent war through the
hangar. USSF and Accord patrols, friendly reinforcements, human pilots and fleet
combat belong in that universe, not independent copies launched as side missions.
Continue building the Orbital simulation with Three.js as the main renderer;
renderers and camera effects never decide damage, identity, or rewards.

One universe does not mean one enormous room or global exact-position visibility.
Canonical spatial sessions partition authority and stream nearby actors.
Different locations must remain isolated until an authoritative handoff exists.

## Preserved reference

[Original supplied architecture and battle verification](references/LIVING-OPEN-ORBITAL-UNIVERSE-ARCHITECTURE-AND-BATTLE-SOURCE.txt)
is preserved verbatim. The two supplied copies were byte-identical.
Treat its repository findings as historical, not current certification: its
claims that free-flight weapons are disconnected and sessions are only
process-local do not describe the current integration source.

## What current source provides

- Authenticated admission derives identity, ship, faction and saved location on
  the server; nearby pilot and patrol snapshots feed the flight scene.
- The shared runtime routes a spatial session to one Redis-coordinated owner
  using leases and fencing tokens. PostgreSQL checkpoints provide durability;
  Redis Pub/Sub is transport, not the permanent world record.
- The free-flight runtime includes server-owned combat and encounter settlement.
  Existing logic is not proof of a successful live two-fleet certification.
- Persistent patrol records represent strategic fleet state. Current-region and
  nearby contacts are resolved into bounded live sessions. This is not proof that
  every fleet in the universe is continuously simulated without players.

### Observed Development runtime

The running Development socket reports `mode: process-local` and
`checkpointStore: false`, with database-backed admission and free-flight combat
enabled. Distributed transport/checkpoint code existing in the repository does
not mean those capabilities are enabled in this environment. No staging
configuration or Production behavior was verified or changed in this review.
The public preview currently opens a local training/universe page, which also
must not be mistaken for authenticated shared-world admission.

See [distributed multiplayer](DISTRIBUTED-MULTIPLAYER-MESH-REFERENCE.md),
[persistent patrols](PERSISTENT-MULTI-SHIP-UNIVERSE-PATROLS.md), and
[persistence verification](PERSISTENT-UNIVERSE-VERIFICATION.md).

## Connection messages inside flight

| Message | Meaning |
| --- | --- |
| CONNECTING | Opening the flight connection; admission not confirmed. |
| AUTHENTICATING | Waiting for authenticated server admission. |
| SHARED FLIGHT | Server admitted this pilot and supplied its session snapshot. Only nearby actors are streamed. |
| RECONNECTING | Transport interrupted; shared participation is not currently confirmed. |
| LINK UNAVAILABLE | Admission or client loading failed; not evidence of a working shared session. |
| RECOVERY REQUIRED | Restore the saved ship through the hangar; reconnect cannot bypass recovery. |
| LOCAL PREVIEW | Local-only flight, not shared multiplayer. |

Public operation directory/event-feed availability is a separate signal and
must not be represented as proof of gameplay admission. Browser-host or preview
availability messages outside the game also do not certify gameplay connectivity.

## Remaining acceptance gates

The [distributed adoption guide](DISTRIBUTED-SHARED-UNIVERSE-ADOPTION.md)
preserves the later synchronization, scale-audit and thruster proposals and
defines fail-closed persistent-runtime startup and safe staging activation.

Do not claim a fully continuous, globally active universe until these are proven:

1. Two authenticated pilots on separate socket instances receive the same
   authoritative nearby enemies and can join an existing engagement.
2. Human and friendly AI weapons damage the same two hostile fleets. Actual
   projectile hits destroy ships; AI final blows do not become human kills.
3. Human kills/assists and rewards settle once from contribution records.
4. Both pilots continue exploring and encounter another fleet without a separate
   combat launch or a reset of the flight universe.
5. Owner failure/restart restores valid health, movement, locks, projectiles and
   encounter state without duplicate actors, ownership or settlement.
6. Canonical region changes transfer ownership and interest safely, without
   revealing distant exact pilot locations.
7. Idle-region patrol advancement and persistent consequences work without an
   observer; runtime budgets remain bounded and physical Android performance is measured.

These are rollout gates, not assertions of newly completed staging tests.
Preserve existing opt-ins and rollback paths; Production remains unchanged.
