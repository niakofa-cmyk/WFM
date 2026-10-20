---
name: Ship balance certification
description: Methodological guardrails for the game's automated ship-balance benchmark.
---

The simulator stores lock/homing on the player match, not per craft, so scripted opponents do not receive equivalent lock opportunities. Report 1v1 scores as one-sided diagnostics, not symmetric balance evidence; normalize shield regeneration and death penalties, and validate candidates in human 5v5 play. Splitter Ring's jam is not a human-control effect.

**Why:** player-only lock state lets the focal pilot home shots while the opponent cannot, and the AI steering jam does not represent its advertised effect against a human. These asymmetries can distort ship rankings even when cohorts repeat.

**How to apply:** before changing balance values, inspect the pilot policy and lock model, normalize side-specific simulation defaults, use fresh cohorts only for regression signals, and confirm promising changes in human 5v5.
