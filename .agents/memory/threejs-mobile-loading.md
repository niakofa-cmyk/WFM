---
name: Three.js mobile loading
description: Keep 3D renderer code out of non-flight screens without defeating Three.js tree-shaking.
---

For WFM mobile loading, import the renderer only after the player starts a 3D flight and show an explicit loading state until the first frame renders. Use a small adapter that re-exports only the named Three.js APIs the renderer needs. Do not retain or pass the full dynamic-import namespace through React state: that made Rollup preserve much more engine code and increased the chunk from its prior measured size.

**Why:** Deferring download is useful only if the lazy chunk remains within its measured budget. A namespace flowing through state obscures property usage from tree-shaking.

**How to apply:** Keep the initial static graph, compressed size, and engine chunk budgets in the production build audit. Check that briefing chunks dynamically import the small adapter, which then statically imports the engine. Measure first-frame behavior on a real Android device before claiming a frame-time or latency improvement.
