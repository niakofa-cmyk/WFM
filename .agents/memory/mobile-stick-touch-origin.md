---
name: Mobile stick touch origin
description: Keep virtual-stick inputs neutral until deliberate movement and confirm behavior on a physical phone.
---

For WFM mobile flight controls, treat the touch-down point as neutral. Turn or thrust only from drag displacement relative to that point, filter tiny drift, and recenter on pointer release or cancellation.

**Why:** A REVVL 8 tester experienced unexpected rightward circling when using the left thumb stick, then confirmed that neutral touch-down, deliberate drag, and release-to-center worked after the change.

**How to apply:** Preserve relative-drag semantics for both touch sticks, cover neutral start and release/cancel with automated tests, and keep a physical Android retest separate from browser emulation.
