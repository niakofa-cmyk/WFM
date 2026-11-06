---
name: Infinite War structural rebuild roadmap
description: Owner-designated staged plan for consolidating WFM into one connected game journey.
---

The full owner source is preserved unchanged at
`docs/infinite-war/STRUCTURAL-REBUILD-STRATEGY.txt`. The maintained summary and
current checkpoint are in `docs/infinite-war/STRUCTURAL-REBUILD-ROADMAP.md`.
The repo-specific menu/consolidation diagnosis is preserved at
`docs/infinite-war/REPO-UNIFICATION-REQUEST.txt`.

The central direction is one connected WAR FOR MARS experience: one identity,
one saved ship/loadout, operations in a shared universe, and validated outcomes
that lead back to the Hangar. The latest owner priority is command center,
Hangar, operation-specific combat-engine integration, universe destinations,
then persistent settings. Orbital Combat Lab is a development/validation
foundation; preserve Rust Disc, Arcade, and Wing as explicit independent
experiences until each migration passes its own proof and rollback gates.

**Why:** the owner designated this roadmap to guide the evolutionary rebuild.
It explicitly warns against another parallel runtime or discarding verified
systems before replacements and rollback are proven.

**How to apply:** retain the custom Three.js/Vite universe presentation and
existing Clerk, Wing, co-op, campaign, economy, and progression contracts. Keep
the mode-specific combat engine explicit behind each operation entry point.
Treat the menu-to-mission-to-debrief-to-progression loop as incomplete until
verified end-to-end. Keep local trainers/approaches no-reward; keep multiplayer
outcomes and progression server-authoritative; distinguish code, tests, staging,
and physical-device evidence. Consolidate the command screen without deleting
older routes; migrate one runtime and progression contract at a time.
