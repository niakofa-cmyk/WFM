---
name: Three.js retirement
description: Orbital is exclusive; retired legacy modes must not return as deferred Three.js chunks.
---

The owner chose immediate removal of Three.js and retirement of unported combat, campaign, and sector presentation. Keep Three.js absent from dependencies and all build chunks. The active native flight scope is Cinder Ring; it does not imply parity for the retired modes.

**Why:** The owner preferred retiring old modes over retaining a competing renderer. Deferred chunks would still violate the exclusive Orbital-engine direction.

**How to apply:** Reject Three.js module IDs in both production builds. Reintroduce a retired mode only after rebuilding its presentation in Orbital and reconnecting its established server authority; never treat removal as feature migration.
