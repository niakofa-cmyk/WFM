# Multi-fleet assistance and aerial-action reference

## Direction

Allied humans and the proposed friendly AI reserve should physically approach
and assist a pilot already engaged with multiple hostile fleets in the same
continuous Orbital universe. They must use the existing 3D flight, projectile,
collision, damage and settlement systems. Do not launch another world, teleport
reinforcements beside the pilot, fabricate human seats, or directly destroy
targets to demonstrate a successful battle.

The requested 20% friendly AI share is a population-balancing target, not an
implemented ratio or a guarantee that an escort is always available nearby.
Read [the population direction](FACTION-POPULATION-AND-AI-ESCORT-DIRECTION.md)
before changing supply, respawn or reward policies.

## Uploaded reference retained verbatim

The complete owner upload is preserved at
[UNIFIED-MULTI-FLEET-AERIAL-ACTION.source.txt](references/UNIFIED-MULTI-FLEET-AERIAL-ACTION.source.txt).
It is a design reference, **not verified production code**.

Useful goals: bounded memory, reduced hot-loop allocation, one shared rendering
context, instancing where appropriate, interpolation, lazy renderer loading,
and assistance inside the same simulation.

Do not copy these sample behaviors:

- Hard-coded human identities and profile balances are not authenticated pilots.
- Setting enemy health to zero bypasses firing, collision, damage, attribution,
  and combat verification.
- Injecting one AI actor does not implement or measure a 20% population share.
- The flat sample contains only X/Y position, velocity and heading. It omits
  our 3D quaternion flight, vertical thrust, shields, missiles, maneuvers, leases
  and persistent settlement. Its integration also lacks a time-step factor.
- Instancing two materials is not a single draw call for the entire universe.
  Allocating an Object3D during every update and uploading thousands of unused
  matrices is not zero-allocation rendering.
- The React effect depends on every traffic array, repeatedly recreating the
  renderer/context. Its localhost socket and CommonJS `require` calls are not
  suitable replacements for the existing authenticated, routed Vite application.
- `heading * Math.PI / 12` is not degree-to-radian conversion.
- “0% frame drops,” “no garbage collection,” and the claimed bundle weight
  require measurement. They are not consequences of copying this code.

Keep the current lazy Three.js foundation and native WebGL2 companion path;
do not replace the deterministic Orbital simulation with the sample 2D engine.

## Verification status

| Requirement | Evidence | Remaining limit |
| --- | --- | --- |
| Two human pilots damage the same enemies | Authenticated staging: three enemy ships destroyed, kills/assists and matching settled credit balances | Both pilots joined the opening battle; this was not a later human arriving during two fleet engagements |
| Human enters an existing encounter | Existing native runtime regression verifies nearby automatic admission without another reservation | Combined late-arrival + two-fleet victory is not staging-certified |
| Multiple hostile contracts remain active | Native continuity regression verifies two later concurrent encounters after an earlier fleet defeat | This is not a surviving victory over both later fleets |
| Traffic refresh without reload | Staging observed a friendly two-ship fleet arriving in live snapshots | Friendly presence is not AI combat assistance |
| Friendly AI pursues, fires, takes damage and helps defeat two fleets | **Not implemented in the live runtime and not verified** | Requires real dispatch/lease ownership, shared encounter membership, AI targeting and friendly casualty persistence |
| 20% friendly force ratio | Direction saved | Active-human census, population controller and measured regional hull share are not implemented |

## Implemented foundation in this review

### NPC attribution and casualty settlement

The private server encounter contract can now admit an allied NPC without a
player identity, reward eligibility or human account seat. It rejects opposing
factions, identity conflicts, backdated admissions, invalid hulls and overflow.
This is **contract groundwork**, not a live AI spawn/dispatch path.

When an admitted AI lands a final blow, legitimate human contributors retain
assists, but no human receives that AI's kill or an invented bounty. An enemy
destroyed only by AI grants no human kill credit. The result now carries the
reserved patrol's actual destroyed NPC identities independently of human kill
awards, so settlement can retire those ships rather than accidentally retaining
them just because no player made the final shot. Duplicate settlement still
returns the previous result without applying casualties again.

Tests in `exploration-allied-npc.test.ts` exercise private contract damage events
and settlement. **They do not prove autonomous firing, physical arrival, or a
live AI victory.** Native projectile and multiplayer tests remain separate.

### Lower-allocation combat targeting

The live server now chooses eligible targets with a single scan rather than
building and sorting temporary candidate arrays. It preserves the existing
range/cone checks, encounter membership, alive/connected rules, nearest-target
selection and stable identity tie-break. Patrol pursuit similarly finds the
nearest participant without sorting a temporary roster every tick.

This reduces specific hot-loop allocations; it does not claim that the complete
engine is allocation-free, lag-free, or certified at thousands of entities.
No flight constants, ship stats, shields, weapons or maneuver rules were changed
by this optimization.

## Required next integration, before claiming friendly-AI assistance

1. Reserve a real same-faction patrol or explicitly budgeted escort reserve with
   exclusive server ownership. Preserve its actual positions and hull identities.
   Define a friendly casualty receipt and lease lifecycle across simultaneous
   hostile contracts, including retry, disconnect, shutdown and recovery.
2. Route it physically toward the battle and authorize it in each relevant
   encounter. Use existing native steering, weapons and collision. Permit enemy
   targeting/damage against the escort; never make it invulnerable or rewardable
   player-like cannon fodder. Return surviving escorts to patrol.
3. Verify the complete combined journey: pilot encounters two hostile fleets,
   a later authenticated ally arrives, friendly AI arrives and exchanges real
   shots, enemies are destroyed through hits, AI and enemy casualties persist,
   human kills/assists settle once, and surviving humans continue exploring.
   Require battle-range visual evidence and measured frame/network timing.

Repeat hostile encounters also need the bounded replacement-generation
lifecycle identified in
[the continuity report](FREE-FLIGHT-COMBAT-CONTINUITY.md). Do not resurrect a
defeated fixed-ID fleet to produce a convenient test opponent.
