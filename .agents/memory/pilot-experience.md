---
name: Pilot experience
description: The WFM flight HUD and touch-control direction.
---

Treat [the pilot-experience reconstruction](../../docs/infinite-war/PILOT-EXPERIENCE-RECONSTRUCTION.md) and [left-thumb control directive](../../docs/infinite-war/LEFT-THUMB-FLIGHT-CONTROL-DIRECTIVE.md) as leading references for active flight screens and touch behavior.
Use [the image-reference review](../../docs/infinite-war/PILOT-IMAGE-REFERENCE-REVIEW.md) for visual composition; treat supplied images as inspiration, not artwork or interface to copy.

**Rule:** Keep the ship, flight space, and combat readable. In offline Orbital, left-stick up/down drives forward/reverse throttle and left/right turns with coordinated bank; the right stick retains pitch/aim. Same-sector edge double-taps remain short vector-thrust pulses (up/down vertical, left/right lateral), and the up-arrow action is vertical thrust. Keep target lock and the maneuver drawer on the left; keep missiles and primary fire by right-stick aim. Do not show a duplicate forward button by default. Preserve Rust Disc and live Wing mappings.

**Why:** The user clarified on 2026-11-05 that the Orbital left stick must be the primary propulsion control: up/down drives forward/reverse, horizontal drag turns while thrusting, and the up-arrow action is vertical rather than forward thrust. They also want target lock grouped with left-side flight controls while missiles and primary fire stay right. Rust Disc's source currently uses left-stick yaw/pitch with a separate throttle action, so do not claim its behavior is identical. The landscape reference still defines the HUD grouping, and live Wing's validated mapping must remain intact.

**How to apply:** Refactor the existing Orbital input/render path, not the shared simulator or a second control engine. Keep left-stick Y on signed throttle, X on yaw/coordinated bank, right-stick aim/pitch independent, and vertical/lateral vector pulses on edge double-taps. The up-arrow action must not change forward throttle. Place lock and the maneuver drawer with the left stick; leave missile and primary fire with right-stick aim. Keep landscape controls in opposite lower corners and leave legacy Rust Disc and live Wing paths unchanged. Maintain neutral touch origin, short gesture timing, cooldown, release/cancel reset, and six-axis physics. Do not treat browser emulation as physical-device certification; follow [the live Wing migration gates](../../docs/infinite-war/LIVE-WING-FLIGHT-CONTROL-MIGRATION-PLAN.md).
