---
name: WFM master development directive
description: Owner-designated execution order and consolidation rules for Infinite War.
---

The latest complete owner directive is retained at
`attached_assets/Pasted--MASTER-DEVELOPMENT-DIRECTIVE-WAR-FOR-MARS-INFINITE-WAR_1793819815572.txt`.
Its code-grounded companion is
`docs/infinite-war/MASTER-ENGINE-FEATURE-EXTRACTION.md`; the broader product
direction remains in `docs/infinite-war/MASTER-DEVELOPMENT-DIRECTIVE.md`.

The directive is the leading execution reference for WFM consolidation. Its
engine rule is one canonical Orbital Combat foundation, with Rust Disc, Iron
Eclipse, Route to Mars, Arcade, Campaign, co-op, and Wing capabilities migrated
through versioned, tested operation adapters.

**Why:** the newest owner directive explicitly designates Orbital Combat as the
main engine and calls for extraction of verified systems, not a visual-only
rebuild. It also requires mobile controls, deterministic simulation, server
authority, compatibility, and rollback during migration.

**How to apply:** use the source-backed extraction matrix before broad rewrites.
Keep the custom Three.js/Vite renderer, but move mode gameplay toward the shared
Orbital simulation through explicit adapters. Preserve Clerk identity, Wing
matchmaking/rewards, co-op progression, campaign claims, and account data.
Integrate one versioned slice at a time; keep training no-reward; do not claim
mobile performance, live ten-human orbital combat, or full mode migration without
their acceptance evidence.
