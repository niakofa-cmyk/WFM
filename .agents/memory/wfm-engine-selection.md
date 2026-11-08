---
name: WFM rendering strategy
description: One Orbital universe uses Three.js as its primary renderer and native WebGL2 as a supported companion.
---

The owner clarified on 2026-11-08: keep and use both Three.js and native Orbital
WebGL2 rendering. Orbital Combat Lab remains the one game/universe and shared
simulation owner. Three.js is the primary renderer for the main open universe;
native WebGL2 remains an additional preview, specialized, or measured fallback
path. Neither renderer may create its own gameplay state or a duplicate universe.

**Why:** the owner directly revised the previous renderer-retirement direction
and asked that both rendering paths be retained while the main Combat Lab
universe remains the focus.

**How to apply:** use
`docs/infinite-war/RENDERING-STRATEGY-AND-UNIVERSE-OWNER.md` as the current
source. Preserve shared Orbital controls, physics, world coordinates, and
authority across renderers. Measure performance and parity rather than
inferring them from package size. Older Orbital-only-renderer documents are
historical on renderer removal, but their audit evidence and safety gates remain
useful.
