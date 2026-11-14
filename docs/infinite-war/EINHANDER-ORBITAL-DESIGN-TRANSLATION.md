# Einhänder reference translated to WFM's living Orbital universe

## Source and limits

The creator supplied the complete forensic architecture analysis, preserved
unaltered in [the reference archive](references/EINHANDER-FORENSIC-ARCHITECTURE-CREATOR-REFERENCE.txt).
Its SHA-256 is `7eba9739636fd7ca8277a40e80318eeebc85d53e58135d6c3496f835b52193d6`.
This is design research and proposed reconstruction, **not** an original-source
audit, licensed artwork, or proof that every proposed WFM feature already works.
External credit, historical and performance claims are attributed to that
document; they are not independently certified here.

## Preserve WFM's foundation

- One hangar entry into the continuous, persistent multiplayer Orbital universe.
- Three.js remains the primary renderer inside that universe; the supported
  native WebGL companion does not introduce a second authoritative game.
- Preserve full three-dimensional flight, heading-stable player-controlled
  camera, shared celestial coordinates and server-owned movement and combat.
- Do not import a side-scrolling plane, rail stage, forced camera swing,
  instantaneous loadout replacement or client-authoritative rewards.
- Keep the asteroid competitive arena as the already-authorized alternative;
  the reference does not authorize a new standalone training game.

## Apply the useful ideas

| Reference idea | WFM application and status |
| --- | --- |
| Distinguishable projectiles and readable impacts | Implemented here: capability-negotiated, bounded server projectile positions, curved missile trails and stable launch/contact identity. Existing faction/weapon colours, server surface contacts and destruction effects remain. |
| Military equipment with physical mounting limits | Build on existing compatible primary/secondary/special/defensive hardpoints and server-verified wreck recovery. Do not replace them with unrestricted gunpod swaps. |
| Destroy functional components | Build on existing engine, weapon, shield, sensor and other subsystem consequences. Component disable is not automatically a hull kill. |
| Beginning, escalation and resolution | Build on persistent patrol operational state and living formations; command exposure, retreats and assistance must reflect existing ships and observed threats, not fabricated reinforcements. |
| Enemy silhouettes and coordinated formations | Preserve faction hull identities; future art/formation changes must retain mobile visibility and measurable rendering budgets. Do not copy referenced game artwork. |
| Dynamic cooperative combat | Nearby authenticated allies and eligible friendly AI participate in the same authoritative encounter; no separate co-op mission runtime. |
| Score and risk/reward | Retain verified kill/assist attribution, recovery and settlement. A historical multiplier is not permission to issue unvalidated currency or permanent damage inflation. |
| Cinematic industrial atmosphere | Use contrasting faction weapons, readable silhouettes and local contact effects. Lighting, audio and additional assets remain separate work; camera choreography must not take control from the pilot. |
| Efficient architecture | Keep lazy renderer loading, bounded effects, negotiated protocols and deterministic shared simulation. Do not replace tested systems with speculative sample code. |

## Six required design pillars

The creator explicitly reaffirmed the following six requirements. They apply
inside the continuous multiplayer universe, not only in menus or a separate
demonstration. The following is a source-level assessment, **not** a physical
device or deployed gameplay certification.

1. **Weapons belong to the universe.** Compatible hardpoints, issued flight
   equipment, ammunition/heat/power, owned modules and physical wreck crates
   exist. Recovery adds to the locker and fitting occurs at the established
   service boundary, not instantaneously in combat. **Partial:** the current
   `salvagePackage` function selects from a deterministic catalog pool using
   encounter/actor identity. It does not establish that the recovered module
   was the exact piece fitted to, rendered on and fired by that enemy.
   Hull-authored weapon geometry is not proof of per-item mounted geometry.
   Completion requires one authoritative enemy equipment manifest driving its
   weapons, mount presentation and surviving recoverable hardware, with
   compatibility, ownership and duplicate-recovery protections preserved.
2. **Enemy components have tactical purposes.** Eight server-owned component
   states affect propulsion, guns, launchers, shields, sensors, communications,
   reactor and bridge. Penetrating hits select approximate local hull regions;
   the selected subsystem aim marker is not client authority over damage.
   Completion evidence must show different tactics producing different
   surviving enemy capabilities. Do not label approximate region collision
   as individually authored, triangle-accurate turret collision.
3. **The environment participates in combat.** Registered celestial/asteroid
   collision volumes provide cover and stop physical rounds, and confirmed
   world contacts drive sparks. **Partial:** collision and a spark do not make
   a station, asteroid, factory or reactor destructible. Tactical environment
   work must define server-owned object health, solid cover, hazards, damage
   permissions, shared state and recovery before any visible destruction can
   alter routes or objectives. The referenced train/city/factory scenes are
   examples, not existing WFM environments.
4. **Encounters are deliberately composed without restricting 3D flight.**
   Persistent formations, observation/detection, role-based positioning,
   threat, command exposure, retreat and allied participation are the existing
   foundation. A reinforcement request is not a dispatched fleet. Heavy
   arrivals and boss phases must use actual available world entities and
   authoritative state; do not add rail stages, fabricate human allies,
   teleport ships or swing the pilot's camera to force drama.
5. **Learning relationships improves outcomes.** Existing subsystem selection,
   cover, ammunition, heat, guidance, countermeasures, maneuver energy and
   compatible equipment create learnable constraints. Completion requires
   readable, truthful feedback connecting actions to consequences and
   objectives. **Partial:** the existence of statistics or a reward ledger
   does not prove that players can understand these relationships. Do not
   invent permanent damage inflation or client-issued rewards as a substitute.
6. **One coherent industrial military science-fiction aesthetic.** Preserve
   faction silhouettes, compatible equipment scale, restrained readable
   contacts, distinct subsystem-disable/destruction effects and uncluttered
   controls. **Partial:** the presence of ship models, weapon colours and sound
   effects is not certification of a coherent soundtrack, lighting and art
   direction across the whole universe. Future audiovisual work must remain
   original/licensed, readable on supported phones and performance-budgeted.

### Evidence map

- Equipment and fitting: `MODULAR-MILITARY-EQUIPMENT.md`,
  `artifacts/api-server/src/game/equipment.ts`, shared equipment catalog,
  shared-flight salvage protocol and Three.js salvage visuals.
- Mechanical enemies: `SHIP-SUBSYSTEM-COMBAT.md`, shared subsystem rules and
  server projectile/contact handling.
- Orchestration: `LIVING-ENEMY-FORMATIONS.md`, persistent patrol and encounter
  runtime. Its explicit limitations still apply.
- Presentation: `SHARED-FLIGHT-DAMAGE-AND-EXPLOSION-VISUALS.md`, main Three.js
  `Arena.tsx`, impact pools and shared projectile-motion presentation.

Source and Node/scene-graph evidence may establish contracts and integration;
they do not close the two-phone visual acceptance gate.

## Missile implementation evidence boundary

The missile path work is presentation fed by the existing authoritative runtime.
It does not change weapon damage, guidance physics, ammunition, collisions,
targeting permission, kill ownership or reward settlement.

Protocol and runtime fixtures can prove curved guidance, shared surface contact,
interest isolation, compatibility, deduplication and restart identity. They
cannot certify an authenticated two-phone staging battle or Android frame time.
No staging deployment or fresh sign-in is implied by archiving this reference.

See [shared combat visual authority](SHARED-FLIGHT-DAMAGE-AND-EXPLOSION-VISUALS.md)
for the implementation contract and verification record.
