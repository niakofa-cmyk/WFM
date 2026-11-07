---
name: Orbital-native spectator boundary
description: Scope and authority boundary for the native 3D asteroid match spectator.
---

The asteroid's native 3D match spectator is a read-only presentation of the existing server-owned anonymous match snapshot. It does not create continuous universe traffic, control a match, identify players, or change rewards.

**Why:** The live match already has authoritative state and a privacy-safe spectator projection; a second simulation would risk divergence and expose unnecessary player data.

**How to apply:** Render only validated snapshots and anonymous contact data. Keep human match authority on the server. Do not claim continuous open-universe traffic or a complete Orbital-only renderer migration until those separate systems pass their own parity and device gates.
