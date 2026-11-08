# Live 3D free-flight presence and patrols

## Foundational requirement

Enemy fleets and authenticated pilot ships must appear as live 3D actors inside the same Orbital free-flight universe. The server owns actor movement, combat state, spatial-session membership and authoritative snapshots. The client renders and interpolates those snapshots; it never submits authoritative positions, health, weapon outcomes or identity.

Public presence remains anonymous and aggregate-only. Exact nearby pilot positions are disclosed only to authenticated participants admitted by the server into the same spatial session. A public directory, leaderboard, event feed or unauthenticated endpoint must never expose actor coordinates, player IDs, callsigns, ship ownership or a reverse mapping to account identity.

This is a runtime requirement, not a claim that all of its stages are complete.

## Admission and spatial isolation

- The client requests the dedicated free-flight socket path and authenticates through the existing Clerk session verifier.
- The server resolves faction, selected ship and current persistent location from the authenticated player's database records.
- The client cannot choose or override the session key, faction, ship, spawn position or actor ID.
- The server derives the initial spatial session from the persisted location. Only participants admitted to that same server-derived session receive exact nearby actor snapshots.
- Snapshots include only the viewer's own actor, authenticated connected pilots within the proximity radius, and nearby server-owned NPC patrol actors.
- Pilot actor IDs are opaque session identifiers. Account IDs and user-supplied names are not sent to other clients. Callsigns are deliberately generic and faction-sensitive.

The current first slice uses the persisted world location as its spatial-session boundary and filters individual actors by proximity. A finer cell/region handoff protocol, cross-cell interest management and seamless streaming are future work; do not describe the current location-scoped session as a complete spatial-cell streaming system.

## Authoritative movement and patrols

The server advances free-flight movement at 30 Hz using the shared `@workspace/orbital-sim` flight kernel. It broadcasts server-owned actor snapshots at 10 Hz. The client is a renderer/interpolator only.

The initial runtime seeds both faction patrol groups in each active location session. Patrol ships follow server-owned waypoints using the same Orbital spatial-flight integrator. Their movement and state are not projected from a client-side patrol simulation.

Inputs are validated against the versioned Orbital input contract, sequence-monotonic, rate-limited and accepted as control intent only. Client-submitted position, velocity, health or combat results are never accepted. Until the combat-authority slice is implemented, firing, missile launches and target assignments are explicitly rejected by the free-flight protocol rather than simulated locally or represented as successful server combat.

## Current code slice

The branch `feature/shared-orbital-freeflight-runtime` adds:

- A dedicated authenticated `/ws?freeflight=1` connection mode on the existing socket server.
- Database-backed admission using the player's persisted faction, selected ship and current world location.
- A location-scoped in-memory spatial session with reconnect-safe pilot actors.
- Server-authoritative 30 Hz Orbital movement and 10 Hz nearby-actor snapshots.
- Server-owned patrol actors for both factions, following waypoints in 3D.
- Proximity filtering, generic pilot callsigns, opaque actor IDs and no account identifiers in actor snapshots.
- Strict input parsing, sequence checks, rate limiting and explicit rejection of combat intents that are not yet server-authoritative.
- An opt-in feature flag: `ORBITAL_FREE_FLIGHT_ENABLED=true`, with a configured database required. It is disabled by default.

## Not yet implemented

- Client-side rendering/interpolation of these authoritative free-flight snapshots in the Orbital universe scene.
- Full server-authoritative free-flight weapons, damage, targeting, destruction, respawn and combat resolution.
- Persistent NPC patrol intent/route state across process restarts or multiple socket-server replicas.
- Database-backed spatial-session leases, multi-instance session coordination and horizontal sharding.
- Fine-grained spatial-cell transitions, floating-origin rebasing, world streaming and cross-region interest management.
- Public anonymous aggregate-presence publication from these active free-flight sessions.
- Production feature enablement, database/deployment verification, physical-device testing or long-duration load certification.

The current runtime is process-local. It provides the first shared movement/snapshot channel but is not yet a durable, horizontally scaled universe simulation. A process restart interrupts the session; it does not restore exact in-flight actor state.

## Acceptance gates

1. Verify the socket authenticates every participant and derives admission from persisted account/world data.
2. Verify a client cannot select a session, spawn position, faction, ship, actor ID, movement state or combat result.
3. Verify two authenticated pilots in one admitted session receive nearby 3D snapshots, while pilots in another session do not.
4. Verify pilot and patrol movement advances only on the server and snapshots contain no account identifiers.
5. Verify reconnects cannot detach a replacement socket and disconnect grace removes stale actors safely.
6. Add the Orbital scene renderer with interpolation/extrapolation from snapshots; do not run a second client-authoritative patrol simulation.
7. Implement and certify server-authoritative weapons/damage before enabling combat controls.
8. Add durable session coordination and anonymous aggregate presence before production-scale rollout.
9. Test on physical Android/iOS devices and under packet loss, jitter, reconnect, high occupancy and server restart.
10. Keep the feature disabled in production until every applicable gate has evidence and a rollback plan.

## Governing rule

**The server simulates; the client presents. Public presence is anonymous; exact positions are session-authorized. Enemy patrols and authenticated pilots inhabit the same live 3D universe.**
