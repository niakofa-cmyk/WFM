---
name: WFM engine selection
description: Owner's engine guidance and the measured-before-migration rule for the WFM renderer and mobile client.
---

The owner's full engine assessment is preserved at
`attached_assets/Pasted-Worked-for-27s-WAR-FOR-MARS-Choosing-the-Right-Engine-f_1793711493465.txt`;
the project interpretation and benchmark gate are in
`docs/references/wfm-engine-selection.md`.

Keep the Three.js/Vite game operational while measuring it. Unity is the
leading candidate for a future native-mobile client, but migrate only after a
small equivalent combat prototype demonstrates a meaningful benefit on the
same target devices. Treat bundle size, runtime performance, and networking as
separate measurements. Keep authoritative combat, multiplayer, and persistent
universe services independent of the renderer.

**Why:** the owner supplied the engine assessment as implementation guidance;
it explicitly rejects migration based on the engine chunk alone and requires
comparable device measurements before choosing a new engine.

**How to apply:** before engine migration or WebGPU adoption, profile loading,
frame-time, memory, thermal behavior, and sustained combat in both implementations
on defined devices. Do not describe proposed targets as achieved results.
