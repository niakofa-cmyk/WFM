---
name: WFM rendering strategy
description: One Orbital universe uses Three.js as its primary renderer and native WebGL2 as a supported companion.
---

The owner clarified on 2026-11-08: keep Three.js as the main shipped 3D
rendering and scene-runtime foundation for the Orbital open universe and Combat
Lab. Orbital remains the one game/universe, shared gameplay simulation, and
world-state owner. Native WebGL2 remains an additional preview, specialized, or
measured fallback path. Neither renderer may create duplicate gameplay state or
a second universe.

**Why:** the owner directly revised the previous renderer-retirement direction
and asked that both rendering paths be retained while the main Combat Lab
universe remains the focus.

**How to apply:** use
`docs/infinite-war/RENDERING-STRATEGY-AND-UNIVERSE-OWNER.md` as the current
source. Preserve shared Orbital controls, physics, world coordinates, and
authority across renderers. Keep Three.js code-split from the initial menu graph;
that load boundary does not mean it is being retired. Measure performance and
parity rather than inferring them from package size. Older Orbital-only-renderer
documents are historical on renderer removal, but their audit evidence and
safety gates remain useful. Renderer choice does not resolve staging
authentication or multiplayer authority gaps.
