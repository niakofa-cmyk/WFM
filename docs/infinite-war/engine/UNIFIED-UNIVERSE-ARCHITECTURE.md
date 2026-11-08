# Unified universe architecture

## Destination of consolidation

The expanding universe belongs inside the Orbital main-game architecture.
Do not build a second Three.js universe application. Three.js renders engine
state; it is not the simulation authority. The old standalone Combat Lab launch
page is an offline entry point today, not evidence of an integrated universe.

## Existing pieces to extract and connect

| Capability | Actual source | Limit |
|---|---|---|
| Persistent location, travel, discovery, contracts | World routes/DB and `GalaxyScreen.tsx` | Strategic state, not continuous shared flight |
| Destinations and operation lifecycle | `operation-network.ts`, operation schema/routes | Directory/authorization, not combat execution |
| Universe events | Read-only directory/SSE and `UniverseActivityFeed.tsx` | Sanitized events, not detailed nearby ship state |
| Destination presence | Server-owned world location and expiring lease | Anonymous counts; no exact coordinates |
| Cinder approach | `CinderRingDockingApproach.tsx` | Local no-reward docking; not server authorization |
| Mars/sector environments | Sector geometry and mission definitions | Bounded authored worlds, not infinite streaming |

## Live shared 3D flight and pilot presence

The authoritative contract is [`../LIVE-3D-FREE-FLIGHT-PRESENCE-AND-PATROLS.md`](../LIVE-3D-FREE-FLIGHT-PRESENCE-AND-PATROLS.md). Persistent faction fleet behavior is specified in [`../PERSISTENT-ENEMY-FLEET-PATROLS.md`](../PERSISTENT-ENEMY-FLEET-PATROLS.md).

Enemy fleets and authenticated pilots are intended to be live 3D actors in one Orbital free-flight universe. The server owns movement and combat state. Public presence stays anonymous and aggregate-only; exact nearby pilot positions are available only to authenticated participants admitted into the same server-derived spatial session. The current location-scoped socket movement/snapshot slice is process-local and opt-in. It is not yet the client-rendered, combat-complete, durable or horizontally scaled universe.

## Main-engine target contracts

Keep stable IDs for system/sector/location/operation; separate persistent sector
coordinates from local simulation coordinates. A future streaming manager must
bound loaded regions and entities, preserve deterministic generation identities,
and rebase presentation without changing authoritative coordinates.

Anomaly configurations need bounded, versioned force/navigation effects and
server snapshots. A decorative rift is not an implemented anomaly expedition.
Fleet encounters need persistent faction intent, detection/investigation/
interception/hostility/resolution states and authoritative outcomes.

These streaming, floating-origin, anomaly and encounter-director systems are
not completed by this input extraction. Do not label them implemented.

## Player journey target

Identity/faction → saved Hangar hull → launch into the universe → discover and
approach a physical destination → authorized operation → validated debrief →
return to the same world/Hangar. Existing battle services remain reachable
through adapters until their main-engine replacements pass certification.

Only server-confirmed public activity may appear as live. Private rooms stay
unlisted; cached world snapshots must be labeled non-live.
