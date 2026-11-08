# Orbital native renderer — production migration gate

> **Superseded decision:** This checklist records the earlier parity-before-
> removal proposal. The owner later chose immediate Three.js removal and
> retirement of unported modes. Do not use this historical gate to restore
> compatibility rendering or block removal. Current scope and verification are
> in [Orbital Engine-only renderer rebuild](ORBITAL-ENGINE-ONLY-RENDERER-REBUILD.md).

## Current status

**The main Arena renderer is not ready to be replaced.** The native WebGL2
preview is a local, no-reward Cinder sector slice. The existing Arena, Rust
Disc flight presentation, Hangar, and standalone docking approach remain
working compatibility paths. Their Three.js resources stay in place as
rollback until the evidence below is complete.

This iteration advances three migration items:

1. The native preview renders the Cinder Ring station at the same simulation
   coordinates used by the existing local universe contract. A pilot can dock
   inside the 22 m capture range at no more than 4 m/s and within the existing
   35-degree approach-heading tolerance, then undock without losing the local
   flight session. This is not server location authority.
2. The native renderer now constructs a distinct low-poly display mesh for each
   of the sixteen selectable hull IDs. Hull geometry remains presentation-only:
   simulation, collision radii, hit attribution, and weapon outcomes still come
   from the shared Orbital simulation.
3. A fail-closed code and test gate records the conditions required before the
   compatibility renderer may be retired. A single preview or successful build
   cannot satisfy those conditions.
4. Docking exposes a local activity console with a native Cinder skirmish: a
   targetable training drone, hostile guided fire, lock/fire/missile/countermeasure
   input, extraction, and a no-reward debrief all run through the shared Orbital
   sector simulation and native renderer. The existing Arena remains a clearly
   labeled fallback; its return restores the exact docked flight snapshot. The
   station's account-services link does not submit local presence or grant
   location, queue, or reward authority.

The native station is currently visual geometry and an interaction envelope;
it is not a collidable station mesh. The hull models are a lightweight native
renderer foundation, not the final detailed fleet art, damage-state treatment,
or engine/weapon animation package.

## Required evidence before deleting the compatibility renderer

Every row must have reproducible evidence on the same rules, ship, scene,
quality settings, and supported devices. Record route/build IDs and test
artifacts in the relevant release review; do not mark a row complete based only
on source inspection or a desktop screenshot.

| Gate | Required proof | Current state |
|---|---|---|
| All production surfaces | Arena, Rust Disc, Hangar, Cinder docking, and universe transitions use the Orbital renderer lifecycle | **Open** |
| Combat and mission behavior | Inputs, locks, weapons, impacts, hull/shields, objectives, debrief, and restart match the accepted behavior | **Open** |
| Ship visual parity | All selectable hulls have approved silhouettes, visible fittings, faction identity, and damage/ability presentation | **Open** |
| Station and mode transitions | Approach, docking, training launch, return/debrief, undock, abort, and repeated entry work without a second renderer | **Open** |
| Deterministic simulation parity | Identical input traces preserve client, server, and replay results; renderer does not own gameplay rules | **Open** |
| Mobile lifecycle | Physical Android and iOS checks cover landscape, rotation, app background/restore, context loss, touch controls, and cleanup | **Open** |
| Target-device performance | Matched-device startup, frame-time percentiles, draw cost, memory/GPU trend, and thermal observations meet agreed budgets | **Open** |
| Repeated resource safety | Repeated sorties, scene changes, renderer teardown, and recovery do not leak resources or retain input | **Open** |
| Rollback | Restore the compatibility route and confirm account, campaign, matchmaking, and reward flows remain unchanged | **Open** |

`orbital-renderer-migration-gate.ts` implements the fail-closed evidence
predicate. `orbital-renderer-migration-gate.test.ts` ensures the main Arena
continues to use its compatibility renderer while the evidence is incomplete.
Remove or revise that protection only in the same reviewed change that supplies
the completed migration evidence.

## Safety boundaries

- The local preview's dock and hull state do not save player location or grant
  queue entry, multiplayer authority, kill credit, or rewards.
- The native Cinder skirmish is a bounded single-drone encounter, not proof of
  full Arena combat parity. Keep the Arena fallback until fleet combat,
  objectives, transitions, mobile, performance, and rollback gates are met.
- Keep multiplayer movement, encounters, damage, and settlement under their
  current server-owned contracts.
- Do not remove Three.js, `Arena`, or any rollback route as part of a preview
  feature. Dependency removal is a later, separately verified migration gate.
- Browser automation and software WebGL are not physical-device or GPU
  performance certification.
