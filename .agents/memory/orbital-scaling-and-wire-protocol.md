---
name: Orbital scaling and wire protocol
description: Safe adoption rules for large-world coordinates, network transport, and client recovery.
---

Use integer chunk coordinates with bounded local offsets for large Orbital
world positions. Treat this as a precision foundation, not proof of streaming,
shared travel, or persistent sector generation.

Keep current multiplayer protocols until there is a measured need to change
them. A binary transport must be separately versioned, capability-gated,
strictly validated, backward compatible during rollout, and benchmarked against
the actual JSON path under representative load and impairment.

Client-side replay caches and recovered inputs never restore server authority,
combat outcomes, or rewards. Rejoin from a fresh authenticated server snapshot
under the active mode's reconnect policy.

**Why:** the supplied scaling examples proposed `Math.fround` as a blanket
determinism guarantee, an in-place binary protocol replacement, and local
telemetry writes into agent memory. Those approaches risk cross-runtime drift,
client incompatibility, privacy exposure, and forged recovery claims.

**How to apply:** follow
`docs/infinite-war/ORBITAL-SCALE-PROTOCOL-RECOVERY-REDESIGN.md`; require
simulation replay, protocol compatibility, failure recovery, and staged
multi-pilot evidence before enabling any network or authority change.
