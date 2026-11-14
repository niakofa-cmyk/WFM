---
name: Shared celestial reference
description: Moon landmark, shared coordinate agreement, and owner-reported two-phone progress
---

All pilots and celestial scenery must occupy the same authoritative coordinate
frame. Use the existing orbital Moon as a common navigation/checking landmark,
not a viewer-relative object or a reason to force players into one spawn point.

**Why:** on 2026-11-11 the owner confirmed that two phones now share a universe,
but reported different ship placement relative to the Moon. After the frame
correction, the owner explicitly confirmed on 2026-11-11 that both ships appear
at the same location with matching Moon placement and framing on the two phones.
This confirms that observed spatial alignment, not combat, rewards or failover.
Shared session membership alone did not establish a coherent spatial experience.

**How to apply:** reconcile position as well as attitude/velocity. Apply the
same world-to-local origin transform to bodies, ships, effects, gravity, aiming
markers and camera rebasing. Separate genuine pilot separation from a rendering
offset; preserve distance travelled, server authority and recovery state.
Follow `docs/infinite-war/SHARED-CELESTIAL-REFERENCE-FRAME.md`. Do not infer a
passed physical-device alignment check from simulated coordinates alone.
