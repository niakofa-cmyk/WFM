# WFM: The Infinite War — blueprint and implementation guide

## Canonical source

The owner's complete 772-line master plan is retained unchanged at:

`attached_assets/Pasted-WAR-FOR-MARS-The-Infinite-War-Open-Universe-Multiplayer_1793690415379.txt`

This guide records its central product decision and how to apply it to the
current WFM codebase. It is not a claim that the full vision is already
implemented.

## Defining principle

> The universe is the battlefield. Every competitive engagement is an
> operation within the larger war. Every operation can have consequences for
> the universe.

WFM should connect exploration, real-time combat, competitive warfare,
cooperative fleet operations, and persistent faction conflict. Competitive
battles should take place in marked operations within universe sectors, not
feel like a separate game. Exploration should lead to meaningful encounters,
and validated operation outcomes may influence the larger war.

## Intended player loop

1. Enter the universe and choose USSF or Accord.
2. Assemble a squadron, ship, and loadout.
3. Travel through connected, meaningful sectors.
4. Discover hostile forces, strategic objectives, and anomalies.
5. Join or initiate a live operation in the current universe.
6. Fight using shared flight and combat rules.
7. Complete server-validated objectives and receive a validated result.
8. Let eligible results affect progression or war state exactly once.
9. Travel onward to the next destination or conflict.

## Staged delivery order

The source lays out these broad stages:

1. Combat foundation: targeting, aiming, weapons, damage, and destruction.
2. Ship identity: distinct, balanced faction/ship roles and abilities.
3. Reliable 5v5 USSF-versus-Accord combat.
4. Entry to and exit from competitive operations through shared sectors.
5. Warfront objectives and persistent faction consequences.
6. Ranked play, tournaments, leaderboards, and spectator systems.
7. Connected authored/procedural sectors and exploration.
8. Synchronized spatial anomalies and environmental hazards.
9. Larger fleet engagements, then additional systems and universe events.

Each stage must be a playable vertical slice with measurable acceptance tests.
The proposed 10v10, 20v20, 40v40, battle-royale, and large event capacities are
future targets, not current server guarantees. Larger battles should use
bounded instances connected by shared strategic state rather than one server
simulating an unlimited population.

## Design and engineering requirements

- Targeting must communicate target identity, faction, distance, direction,
  motion, health/shields, lock progress, weapon range, and incoming threats.
- Assisted and manual aiming should both be supported; missiles and selected
  weapons may require a valid lock.
- Ship and faction identities must arise from different weapon behaviors,
  roles, and doctrines—not only different colors or damage values.
- Damage must be authoritative and meaningfully affect shields, hull, engines,
  weapons, and sensors. Client visuals show server-confirmed impacts and
  destruction; visuals never decide damage.
- Mobile-friendly flight can still reward momentum management, drift, boost,
  braking, evasive moves, and configurable assists.
- Warfronts need clear opt-in, protected match boundaries, team/objective
  rules, reconnect behavior, and validated outcomes.
- Cosmic anomalies should alter navigation, weapons, or mission choices, not
  exist only as decoration. Forces and hazards must be bounded, deterministic,
  and synchronized by the authoritative server.
- The universe should feel vast through connected destinations, authored
  significance, constrained sector generation, and discoveries; do not promise
  continuous simulation of infinite space.
- Version configuration by mode, sector, and faction; validate it server-side,
  keep sensitive competitive values out of client authority, and provide
  feature flags, history, and rollback for incomplete features.
- Keep rewards and persistent war effects server-owned and idempotent. Never
  let client-submitted damage, match outcome, or reward amount grant progress.

## Current implementation boundary

The repository currently has a local Rust Disc trainer with a training drone,
primary fire, a range/cone/line-of-sight missile lock, missiles, and flares.
It also has server-authoritative cooperative sectors and Operation Iron
Eclipse, including an AI wing and targetable capital-ship subsystems. The 5v5
Wing arena and queues are separate from those open-universe/co-op sectors.
Therefore the unified open-universe warfront, multiplayer target list,
sector-integrated 5v5 battles, tournaments, synchronized anomalies, and
persistent territorial consequences are future work until individually
implemented and verified.

## Non-goals and safety gates

Do not start with an actually infinite continuously simulated galaxy,
thousands of simultaneous ships, 100v100, fully destructible planets,
unrestricted player-created wormholes, or unrestricted player-controlled
capital ships. These are explicitly deferred in the source.

Every major release must provide evidence for mobile flight/performance,
actual weapon hit/damage/destruction behavior, ship balance, authenticated
shared multiplayer, server-authoritative competitive integrity, connected
universe encounters, synchronized anomaly effects, idempotent persistence,
and security. Automated and synthetic tests precede physical-device checks;
physical Android/iOS checks and Production gates remain distinct evidence.

## How this relates to other WFM references

This is the primary product blueprint. The existing documents
`docs/combat-evolution-roadmap.md`, `docs/open-universe-flight-foundation.md`,
and `docs/competitive-battlefield.md` provide narrower implementation details
and safety gates. When the long-term vision and current verified capability
differ, preserve the vision while reporting the capability accurately and
implementing the next bounded stage.
