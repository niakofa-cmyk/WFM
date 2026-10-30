---
name: Ship balance certification
description: Methodological guardrails for the game's automated ship-balance benchmark.
---

Earlier benchmarks had asymmetric player-only lock/homing. Inspect the current lock policy rather than assuming that defect still exists. Report scripted 1v1 scores as diagnostics, not human 5v5 certification; normalize shield regeneration and death penalties. AI steering disruption is not proof of an equivalent effect against human controls.

**Why:** player-only lock state lets the focal pilot home shots while the opponent cannot, and the AI steering jam does not represent its advertised effect against a human. These asymmetries can distort ship rankings even when cohorts repeat.

**How to apply:** before changing balance values, inspect the pilot policy and lock model, normalize side-specific simulation defaults, use fresh cohorts only for regression signals, and confirm promising changes in human 5v5.

Earned specialist combat upgrades affect solo play, not normalized online 5v5.

**Why:** preserve the eight ships' competitive roles; the economy document's illustrative permanent shield upgrade is not evidence that progression-based advantages are fair online.

**How to apply:** keep authoritative solo replay and client simulation consistent, but do not add paid/earned stat bonuses to wing rooms without a deliberate balance decision and multiplayer evidence.
