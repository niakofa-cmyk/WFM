---
name: Pilot experience
description: The WFM flight HUD and touch-control direction.
---

Treat [the pilot-experience reconstruction](../../docs/infinite-war/PILOT-EXPERIENCE-RECONSTRUCTION.md) as the leading reference for active flight screens.
Use [the image-reference review](../../docs/infinite-war/PILOT-IMAGE-REFERENCE-REVIEW.md) for visual composition; treat supplied images as inspiration, not artwork or interface to copy.

**Rule:** Keep the ship, flight space, and combat readable. Use no more than two primary thumb-controlled maneuver surfaces; remove boxy directional pads and keep secondary controls contextual. Expand the tactical map on demand and move settings off the active flight view.

**Why:** The user explicitly identified the current flight HUD as cluttered and asked that this document guide future pilot-experience work.

**How to apply:** Refactor the existing game input/render path rather than creating a parallel control engine. Preserve 6-DOF physics and all functional combat actions, with multiplayer actions still validated by existing server authority. Keep keyboard/gamepad paths for development and accessibility. Verify mobile layouts at landscape sizes; distinguish browser emulation from physical-device certification.
