---
name: WFM master development directive
description: Owner-designated execution order and consolidation rules for Infinite War.
---

The latest reconstruction references are retained unchanged at
`attached_assets/Pasted-War-for-Mars-Infinite-War-Updated-Repository-Forensic-E_1793842864923.txt`
and `attached_assets/Pasted--WAR-FOR-MARS-INFINITE-WAR-MASTER-AI-GAME-DEVELOPMENT-P_1793842908766.txt`.
The current source audit is in
`docs/infinite-war/UPDATED-REPOSITORY-FORENSIC-EVALUATION.md`; the mode inventory
and ordered migration proof gates are in
`docs/infinite-war/INFINITE-UNIVERSE-ORBITAL-RUNTIME-DIRECTION.md`.

The leading direction is one canonical Orbital gameplay runtime, with Rust
Disc, Iron Eclipse, Route to Mars, Arcade, Campaign, co-op, and Wing capabilities
migrated through versioned, tested operation adapters. Do not transplant the
legacy Rust Disc flight scene. Three.js may remain only as a low-level renderer
dependency if the Orbital presentation layer owns scene, camera, renderer and
gameplay-loop lifecycle; removing Three.js itself requires a separate benchmark.

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

The new directive makes Rust Disc pilot controls and co-op operation behavior
required extraction sources, and defines the intended extended universe. Keep
that target distinct from current bounded sectors and navigation. Track
simulation migration separately from presentation migration: a mode must not
be called fully consolidated while a legacy scene owns its rendering lifecycle.
Preserve identity, server authority, progression and rewards throughout migration.
