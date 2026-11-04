---
name: Infinite War structural rebuild roadmap
description: Owner-designated staged plan for consolidating WFM into one connected game journey.
---

The full owner source is preserved unchanged at
`docs/infinite-war/STRUCTURAL-REBUILD-STRATEGY.txt`. The maintained summary and
current checkpoint are in `docs/infinite-war/STRUCTURAL-REBUILD-ROADMAP.md`.

The central direction is one connected WAR FOR MARS experience: one identity,
one saved ship/loadout, operations in a shared universe, and validated outcomes
that lead back to the Hangar. Deliver this in stages A–H, beginning with the
unified player journey and canonical orbital combat, then campaign/co-op,
competitive integration, validated persistence, and later expansion.

**Why:** the owner designated this roadmap to guide the evolutionary rebuild.
It explicitly warns against another parallel runtime or discarding verified
systems before replacements and rollback are proven.

**How to apply:** retain the custom Three.js/Vite runtime and existing Clerk,
Wing, co-op, campaign, economy, and progression contracts. Treat the menu-to-
mission-to-debrief-to-progression loop as incomplete until it is verified
end-to-end. Keep local trainers no-reward; keep multiplayer outcomes and
progression server-authoritative; distinguish code, tests, staging, and physical
device evidence.
