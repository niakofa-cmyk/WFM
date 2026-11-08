---
name: WFM engine selection
description: Owner's engine guidance and the measured-before-migration rule for the WFM renderer and mobile client.
---

The owner's historical engine assessments are preserved in the attached assets
referenced at the top of `docs/references/wfm-engine-selection.md`. The latest
owner direction supersedes their renderer choice: Orbital Engine must own final
gameplay and rendering; Three.js is a technique reference, not a shipped library.

The current repository still uses Three.js as its only working 3D renderer, so
keep it operational only until an Orbital-native replacement passes parity,
performance, and rollback gates. Do not remove it prematurely or introduce a
second renderer. Preserve backend authority for multiplayer, progression, and
the persistent universe.

**Why:** the owner explicitly corrected the goal to a single Orbital rendering
and simulation foundation, while the present source has no complete Orbital
renderer. Performance should be measured, not inferred from Three.js package size.

**How to apply:** follow
`docs/infinite-war/ORBITAL-ENGINE-ONLY-RENDERER-REBUILD.md`. Before retiring the
current renderer, compare bundle/assets, startup, frame time, memory, thermals,
feature behavior, and sustained combat on equivalent target devices. Do not
describe proposed targets as achieved.
