---
name: Ship balance certification
description: Methodological guardrails for the game's automated ship-balance benchmark.
---

For scripted ship benchmarks, give lock-capable ships equivalent lock opportunities and lead shots from observed target movement, including lateral motion. Treat 1v1 results as diagnostic signals, not proof of 5v5 balance; validate candidate tuning in human team play.

**Why:** an early harness omitted lock behavior and reported Sundara at 0%; after correcting lock and movement-aware lead aiming, Sundara measured 50% in two independent cohorts. The benchmark still omits teammates and objectives.

**How to apply:** before changing balance values, inspect the pilot policy, run a fresh seed cohort, and confirm promising changes in a human 5v5 test.
