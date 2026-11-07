---
name: Orbital-native spectator boundary
description: Scope and authority boundary for the native 3D asteroid match spectator.
---

The native renderer has two distinct read-only uses: the asteroid spectator presents the existing server-owned anonymous match snapshot, while the universe view renders bounded regional AI patrol poses projected from persisted route timestamps. Neither path controls a match or changes rewards.

**Why:** The server already owns combat and strategic patrol movement. Client-side interpolation is presentation only; publishing exact human flight coordinates would exceed the established destination-count privacy contract.

**How to apply:** Render server-validated patrol projections and anonymous match snapshots only. Nearby human presence remains a region count, not fabricated individual ship positions. Keep combat authority on the server. Do not claim continuous shared human flight or a complete Orbital-only renderer migration until those separate systems pass their own parity and device gates.
