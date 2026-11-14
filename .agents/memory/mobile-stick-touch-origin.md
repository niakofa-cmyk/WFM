---
name: Mobile stick touch origin
description: Keep virtual-stick inputs neutral until deliberate movement and confirm behavior on a physical phone.
---

For WFM mobile flight controls, treat the touch-down point as neutral. Turn or thrust only from drag displacement relative to that point, filter tiny drift, and recenter on pointer release or cancellation.

In the Orbital arena, fixed visible thumb sticks are the default and user preference. Offer touch-anywhere left/right screen-half zones as an optional device setting; hide each virtual ring until that side is touched, place it at the touch origin, and show a short fade after release. Keep actual action buttons visible and layered above the optional touch zones.

**Why:** A REVVL 8 tester experienced unexpected rightward circling when using the left thumb stick, then confirmed that neutral touch-down, deliberate drag, and release-to-center worked after the change.

**How to apply:** Preserve relative-drag semantics for both control layouts, cover default fixed layout, optional touch-anywhere selection, neutral start, and release/cancel with automated tests, and keep a physical Android retest separate from browser emulation. Any broad touch zone must not intercept action buttons or dialogs.
