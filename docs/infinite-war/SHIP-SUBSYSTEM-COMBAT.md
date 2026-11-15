# Component-based ship combat in the living Orbital universe

## Direction

The creator's equipment/subsystem reference (2026-11-13) establishes that military
ships are assemblies of vulnerable systems, not interchangeable weapons around a
single health bar. The supplied annotated spacecraft image is a placement and
design reference, not a licensed game model:
`attached_assets/3YSJp4O6NOaeVyWMHkW0hadgI7B8ny_42q9UgZVFixF3k-IBczUpfd-Pghro-_1794606795235.jpeg`.

Extend the existing authoritative, continuous shared-flight runtime. Keep
Three.js as the primary presentation layer and the supported companion renderer.
Never create another instance, sortie or battle scene for subsystem combat.

## Implemented combat contract

- Eight independent systems: engines, primary weapons, missile launchers,
  shield generator, sensors, communications, reactor and bridge.
- Health per component is 18% of the issued hull's maximum health. Shield
  absorption happens first. Penetrating damage is divided: 65% to hull before
  existing hull protection, 35% to the physically contacted component.
- The swept projectile/hull contact is transformed into the victim's local
  orientation and compared with eight normalized attachment regions. It is an
  approximate hull-region model, not triangle-accurate collision against
  individual authored turret meshes. The client cannot nominate a damaged system.
- The SYS control cycles engine → weapons → launchers → shields → sensors →
  communications → reactor → bridge → whole hull. It moves the selected aim
  marker to that attachment and shows server health. In component-aim mode,
  primary aim assistance no longer redirects rounds toward the hull center.
  Missiles still home on the ship, not a client-specified internal component.
- A disabled system produces a localized yellow electrical blast, distinct
  from the full destruction explosion; offline own-ship systems appear in
  the existing compact weapon-status line.

| Component | Actual runtime consequence |
|---|---|
| Engines | Reduced translational thrust and steering; destroyed engines remove powered translation/boost but preserve drift and limited attitude control. |
| Primary weapons | Progressive fire-rate loss; zero health prevents new gunshots. |
| Missile launchers | Zero health prevents new missile/rocket launches; already flying ordnance remains live. |
| Shields | Remaining generator condition caps shield strength and regeneration capacity. |
| Sensors | Slower lock acquisition and smaller AI detection radius; destroyed sensors prevent missile locks/launches, not manually aimed guns. |
| Communications | Disabled system prevents help calls and joining a new AI support wing. |
| Reactor | Remaining condition caps available maneuver/weapon power and disables boost at critical condition. |
| Bridge | Disabled command capability prevents coordinated calls/new AI support assignment; does not magically kill the crew or remove self-defense. |

AI withdraws through ordinary flight when reactor-critical or both weapon
systems are lost. Crippled propulsion can prevent effective retreat. Damage does
not automatically repair, teleport, surrender or award rewards.

## Shared state and recovery

Actor checkpoints retain component health, selection and command sequence.
Legacy checkpoints without components read as intact systems until first
penetration; corrupt component states are rejected, not silently reset.
Reconnect advertises the next accepted sequence. Separate versioned telemetry
provides own and selected-target health; the strict legacy snapshot/input shape
remains unchanged. Human and AI victims use the same hit rules.

All observers receive the same authoritative weapon/component-disable event.
Selecting a target exposes that target's current system health. Kill/assist,
salvage and reward settlement still require actual hull destruction through the
existing encounter authority. A disabled engine alone grants none of them.
Normalized asteroid competition and archived Combat Lab rules are unchanged.

## Verification and boundaries

Automated socket checks cover all eight hit regions, isolated disable
transitions, actual server-spawned projectile engine damage received by two
pilot connections, surviving damaged hulls, replayed command rejection,
checkpoint retention, power/shield/weapon suppression and disabled help calls.
These are local runtime checks, not authenticated staging or phone certification.

Not implemented by this increment: surrender/capture/boarding, emergency jumps,
physical turret detachment, authored per-class capital-ship attachment layouts,
AI coordinated reactor focus, subsystem repair, component-specific guided
missile homing, or a new reward for disabling components. Those require separate
gameplay/security/balance work rather than pretending a disabled hull was killed.
No production deployment or database migration is needed or performed here.
