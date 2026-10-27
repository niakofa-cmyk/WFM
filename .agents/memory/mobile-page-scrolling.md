---
name: Mobile page scrolling
description: Preserve vertical touch scrolling on WFM content screens without scrolling the active combat arena.
---

WFM content screens must remain vertically scrollable on phones across device sizes. The active Arena remains full-screen and reserves touch gestures for gameplay controls.

**Why:** The owner reported that vertical touch scrolling failed on a physical staging Android phone and explicitly asked for scrolling across the game's screens and devices. Allowing the page to scroll globally fixes content access, while the combat scene needs gestures reserved for movement and firing.

**How to apply:** Use natural document scrolling for public/auth pages, menus, profile views, lobby, debrief, and solo-flight setup. Keep `touch-action: none` and clipped overflow scoped to the active Arena. Add touch-scroll regression coverage and keep physical-device verification separate from browser emulation.
