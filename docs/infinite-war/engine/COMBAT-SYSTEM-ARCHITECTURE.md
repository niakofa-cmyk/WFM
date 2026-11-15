# Combat system architecture

## Shared primitives

`lib/orbital-sim/src/weapons.ts`, `weapons-catalog.ts`, `flight.ts` and
`lineup.ts` provide target solutions, occlusion, projectile/collision helpers,
missile guidance, countermeasure behavior, hull/armor helpers, versioned weapon
fits and fleet lineup rules. Orbital runtime versions preserve older replay
behavior rather than reinterpreting already-issued campaign runs.

## Remaining owners

Arena/client `orbital-sim.ts` coordinates AI, timers, weapon spawning and damage.
The API has a byte-identical compatibility copy; these remain separate import
owners, not one shared step-function implementation. Ability orchestration also
remains duplicated. Both now call the same library-owned terminal-outcome rule,
and a regression test fails if either copy drifts. The sector adapter has
operation-specific projectile, drone/objective and collision state; shared math
does not merge those rules.
`orbital-visuals.ts` renders model damage/effects and is not damage authority.

## Authority

- Offline Lab, Solo and local Arcade cannot settle rewards or campaign state.
- Campaign uses the server-issued run's pinned simulation and validated replay.
- Cooperative rooms own mission state and debrief on the server.
- Wing owns live combat and competitive settlement under its existing runtime.
- `orbital-authority.ts` is a harness, not proof of a live migrated Wing service.

## Extraction order

1. Engine-owned bounded pilot intent (implemented in this slice).
2. Shared combat orchestration with dependency-injected ship/effect interfaces;
   remove client/API copies only after exact replay fixtures pass.
3. Common operation contracts for AI/objectives/extraction, preserving distinctive
   mechanics rather than forcing all modes into “destroy three defenders.”
4. Versioned online state/input and results with reconnect and reward validation.

Missile lock, ammo, cooldown, energy, damage and results must remain server-owned
online. Flares must be visible feedback for an actual accepted countermeasure
event, not cosmetic proof of missile rejection.
