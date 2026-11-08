# Persistent enemy fleet patrols

## Requirement

USSF and Accord fleets must exist as live, visible 3D actors in the shared Orbital free-flight universe. Patrols are not decorative scene props or client-generated projections. Their positions, routes, faction, ship identity, damage and combat state are server-owned.

See [Live 3D free-flight presence and patrols](LIVE-3D-FREE-FLIGHT-PRESENCE-AND-PATROLS.md) for the authoritative movement, identity, privacy, protocol and release requirements.

## Patrol behavior model

The intended patrol lifecycle is:

1. **Assigned** — a server-owned fleet director assigns a faction patrol group to a system/sector and route.
2. **Transit** — ships move through 3D waypoints using the Orbital flight kernel.
3. **Patrolling** — the group follows its route and maintains role-aware formation spacing.
4. **Investigating** — server-detected anomalies, distress calls or hostile contacts can redirect the group.
5. **Intercepting** — an authorized hostile contact can cause a server-side pursuit order.
6. **Engaged** — weapon acquisition, firing, damage and countermeasures are resolved by the server's Orbital combat authority.
7. **Resolved** — ships return to patrol, retreat, are disabled/destroyed or receive a new persistent order.

The patrol director must preserve faction doctrine, ship role, fleet composition, route identity and encounter consequences. A single generic AI steering loop is only a first movement primitive, not the complete fleet-intelligence system.

## Current runtime evidence

The first shared-flight slice creates two USSF and two Accord patrol actors in each active location-scoped session. They follow server-owned 3D waypoints using the shared Orbital flight integrator and appear in authenticated nearby snapshots.

This is an in-memory runtime seed. It does not yet persist patrol missions, fleet intent, damage, destruction, route progression or encounter consequences across server restarts. Patrol actors currently maneuver but do not autonomously acquire or attack pilots. Combat intents are rejected until the server combat slice is implemented.

## Required next increments

- Persist patrol group identity, faction, fleet composition, route, mission and lifecycle state.
- Move patrol ownership to a server-side fleet director with bounded actor counts and deterministic spawn identities.
- Add server-side sensor/detection rules and spatial interest management.
- Implement role-aware formations and navigation around real world obstacles.
- Integrate Orbital targeting, weapon systems, shields, armor, damage, destruction and retreat.
- Persist meaningful patrol/operation outcomes through existing universe and progression services with idempotent transactions.
- Publish only anonymous aggregate public presence; exact pilot and patrol coordinates remain session-authorized.
- Add restart recovery, multi-replica coordination, capacity limits, telemetry and load tests.

Do not call a patrol persistent merely because its actor remains in one process-local map. Persistence requires durable state and tested recovery.
