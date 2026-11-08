---
name: WFM engine selection
description: Owner's engine guidance and the measured-before-migration rule for the WFM renderer and mobile client.
---

The owner's four engine assessments are preserved in the attached assets
referenced at the top of `docs/references/wfm-engine-selection.md`; that guide
reconciles them with the current implementation and benchmark gate.

Keep Three.js as the primary 3D renderer and scene-runtime foundation for the
Orbital open universe and Combat Lab. Orbital owns shared simulation and
world-state contracts; native WebGL2 is a supported companion renderer. Do not
remove Three.js or treat it as temporary migration infrastructure. Keep
multiplayer authority, progression, and persistent-world consequences on their
trusted services.

**Why:** the owner clarified on 2026-11-08 that Three.js is the main rendering
foundation under Orbital; older renderer-removal recommendations are no longer
controlling.

**How to apply:** keep Three.js code-split and bundle-audited, and measure device
performance before adding another renderer or runtime. Do not infer from a
renderer decision that authentication, multiplayer authority, or deployment
readiness has been verified.
