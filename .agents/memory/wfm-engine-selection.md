---
name: WFM engine selection
description: Owner's engine guidance and the measured-before-migration rule for the WFM renderer and mobile client.
---

The owner's four engine assessments are preserved in the attached assets
referenced at the top of `docs/references/wfm-engine-selection.md`; that guide
reconciles them with the current implementation and benchmark gate.

Keep the custom Three.js/Vite game operational. Needle is the leading
scene-authoring/runtime experiment, not an approved migration; Unity remains a
candidate if native distribution dominates. Build and compare a small equivalent
combat slice before changing engines. Keep WFM flight/simulation custom and
renderer-independent, and preserve backend authority for multiplayer,
progression, and the persistent universe. Consider Rapier or React Three Fiber
only when an isolated benchmark shows a concrete benefit.

**Why:** the owner supplied the engine assessment as implementation guidance;
the newer documents favor custom Three.js and a Needle prototype but still
require measured integration and device performance before choosing a new runtime.

**How to apply:** before adding an engine/physics framework or migrating, compare
scene authoring, integration, bundle/assets, frame-time, memory, thermals, and
sustained combat on defined devices. Do not describe proposed targets as achieved.
