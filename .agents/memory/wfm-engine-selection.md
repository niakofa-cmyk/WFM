---
name: WFM engine selection
description: Owner's engine guidance and the measured-before-migration rule for the WFM renderer and mobile client.
---

The owner's historical engine assessments are preserved in the attached assets
referenced at the top of `docs/references/wfm-engine-selection.md`. The latest
owner direction supersedes their renderer choice: Orbital Engine must own final
gameplay and rendering; Three.js is a technique reference, not a shipped library.

The owner explicitly chose immediate Three.js removal and accepted retiring
unported presentation modes. Keep Three.js absent; the active playable scope is
the Orbital-native Cinder Ring flight slice, not full feature parity. Preserve
backend authority for multiplayer, progression, and the persistent universe.

**Why:** the owner confirmed that Orbital must be the exclusive renderer and
chose retiring legacy modes rather than keeping a deferred Three.js compatibility
runtime. Removing the library does not mean those modes have been migrated.

**How to apply:** follow
`docs/infinite-war/ORBITAL-ENGINE-ONLY-RENDERER-REBUILD.md`. Do not restore
Three.js chunks or advertise retired modes as playable. Rebuild each mode on
Orbital with its server-owned authority and reward contracts verified before
restoring its entry point.
