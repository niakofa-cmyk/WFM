---
name: Infinite War structural rebuild roadmap
description: Owner-designated staged plan for consolidating WFM into one connected game journey.
---

The full owner source is preserved unchanged at
`docs/infinite-war/STRUCTURAL-REBUILD-STRATEGY.txt`. The maintained summary and
current checkpoint are in `docs/infinite-war/STRUCTURAL-REBUILD-ROADMAP.md`.
The repo-specific menu/consolidation diagnosis is preserved at
`docs/infinite-war/REPO-UNIFICATION-REQUEST.txt`.

The owner has now authorized starting a connected-universe visual redesign.
This supersedes the previous appearance deferral without certifying full engine
consolidation. See [master directive](master-development-directive.md) and the
current repository redesign brief.

The central direction is one connected WAR FOR MARS experience: one identity,
one saved ship/loadout, operations in a shared universe, and validated outcomes
that lead back to the Hangar. The earlier UI-first priority order is historical.
Orbital Combat Lab is the main-engine destination; preserve Rust Disc, Arcade,
and Wing as distinct playable experiences through configurations/adapters,
keeping their existing runtimes until migration and rollback gates pass.

**Why:** the owner designated this roadmap to guide the evolutionary rebuild.
It explicitly warns against another parallel runtime or discarding verified
systems before replacements and rollback are proven.

**How to apply:** migrate the temporary Three.js/Vite presentation into the
Orbital-owned renderer, preserving existing Clerk, Wing, co-op, campaign,
economy, and progression contracts. Keep mode-specific behavior explicit behind
each operation entry point.
Treat the menu-to-mission-to-debrief-to-progression loop as incomplete until
verified end-to-end. Keep local trainers/approaches no-reward; keep multiplayer
outcomes and progression server-authoritative; distinguish code, tests, staging,
and physical-device evidence. Consolidate the command screen without deleting
older routes; migrate one runtime and progression contract at a time.
