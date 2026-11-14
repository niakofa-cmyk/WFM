---
name: Orbital-native spectator boundary
description: Scope and authority boundary for the native 3D asteroid match spectator.
---

The owner requires AI faction fleets and authenticated pilot ships to appear as live 3D actors in shared Orbital free flight. The existing strategic patrol projection and anonymous match spectator remain distinct read-only paths; neither is proof that shared human flight is implemented.

**Why:** Aggregate destination counts alone do not meet the owner's explicit requirement for pilots and opposing fleets visibly patrolling in the same free-flight universe.

**How to apply:** Keep exact pilot poses private to nearby authenticated participants in the same bounded spatial session; public directories remain anonymous counts. Server snapshots own position and combat state; renderers only interpolate. Do not fabricate pilot ships or claim live shared flight until the multi-client server-owned path is verified.
