---
name: Pilot experience
description: The WFM flight HUD and touch-control direction.
---

Treat [the pilot-experience reconstruction](../../docs/infinite-war/PILOT-EXPERIENCE-RECONSTRUCTION.md) and [left-thumb control directive](../../docs/infinite-war/LEFT-THUMB-FLIGHT-CONTROL-DIRECTIVE.md) as leading references for active flight screens and touch behavior.
Use [the image-reference review](../../docs/infinite-war/PILOT-IMAGE-REFERENCE-REVIEW.md) for visual composition; treat supplied images as inspiration, not artwork or interface to copy.

**Rule:** Keep the ship, flight space, and combat readable. Use no more than two primary thumb-controlled maneuver surfaces; remove boxy directional pads and keep secondary controls contextual. In offline Orbital Combat and the Rust Disc control adapter, left-stick drag controls yaw/pitch with coordinated bank, while same-sector double-taps on an outer edge trigger a brief vector-thrust pulse (up/down vertical, left/right lateral). Right-stick aim remains usable at the same time. Keep the validated live Wing mapping unchanged.

**Why:** The user asked the left thumb to consolidate ordinary flight maneuvers and trigger special vector thrust without separate direction/roll buttons, while preserving the proven competitive path. Keep pilot-facing axes and simulator axes separated at the mode adapter; changing the shared legacy adapter can reverse already-established Orbital controls.

**How to apply:** Refactor the existing input/render path rather than creating a parallel control engine. Apply Rust Disc sign conversion only in the unified Orbital flight-stick adapter, leaving legacy Orbital and live Wing mappings intact. Maintain a short gesture window, movement threshold, pulse cooldown, release/cancel reset, and existing six-axis physics. Do not port the offline mapping into live Wing unless client/server parity and replay validation are updated together; follow [the live Wing migration gates](../../docs/infinite-war/LIVE-WING-FLIGHT-CONTROL-MIGRATION-PLAN.md). Keep keyboard/gamepad paths and distinguish browser emulation from physical-device certification.
