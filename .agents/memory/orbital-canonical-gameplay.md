---
name: Unified Orbital engine and connected universe
description: Owner's latest direction makes Orbital Combat the shared gameplay engine while preserving versioned migration and service authority.
---

The latest owner reconstruction references are
`attached_assets/Pasted-War-for-Mars-Infinite-War-Updated-Repository-Forensic-E_1793842864923.txt`
and `attached_assets/Pasted--WAR-FOR-MARS-INFINITE-WAR-MASTER-AI-GAME-DEVELOPMENT-P_1793842908766.txt`.
The source-backed current audit is
`docs/infinite-war/UPDATED-REPOSITORY-FORENSIC-EVALUATION.md`.

**Rule:** WFM is one connected universe with Orbital Combat as the canonical
gameplay runtime for Rust Disc, Iron Eclipse, Route to Mars, Arcade, Campaign,
co-op, and competitive operations. Do not use the old Rust Disc scene as the
new rendering runtime. Three.js is allowed as a low-level dependency only when
Orbital owns the scene, camera, renderer, and gameplay-loop lifecycle. Track
simulation and presentation migration separately. Preserve compatibility paths
only until each mode's flight, controls, objectives, authority, and presentation
are migrated and verified. Retain existing identity, matchmaking, economy,
progression, and reward services.

**Why:** the latest owner directives explicitly prohibit reusing the Rust Disc
scene as the new runtime while allowing a proven graphics library to serve inside
Orbital; they also require staged migration, rollback, server authority, and
preservation of verified systems.

**How to apply:** move one mode at a time through shared controls, simulation,
and Orbital-owned presentation adapters; version any changed network or replay
contract. Migrate client, API, and socket together when authority changes. Keep
Orbital training no-reward, preserve Wing's server-owned competitive and reward
gates, and retire a legacy path only after parity, acceptance, and rollback pass.

**Current slice:** Cinder Ring's directory now includes the 5v5 Wing Relay
arena, the local `flight-sector-v1` training circuit, and the Rust Disc
cooperative operation. Competitive queue entry requires the existing server
location check. Only a live ten-human queue match is published; its operation
record uses a service-owned identity and exposes aggregate occupancy, phase, and
a match UUID, never pilot IDs or callsigns. Authenticated spectators receive a
read-only, identity-scrubbed snapshot stream; they do not consume player seats.
Private rooms and AI-fill matches are not published. Rust Disc discovery and
settlement remain separate. This implementation is code-level until a staging
deployment and real-client checks prove it works end to end.

**Why:** the asteroid is meant to be a genuine competitive destination, while
private invitations and pilot identities must remain private.

**How to apply:** keep private rooms private, validate competitive location on
the server, and publish only match status and anonymized spectator state. Never
infer a live match from a catalog entry or change Wing reward rules through
this directory.

**Why:** application code and catalog definitions do not create live operations;
the server must register each session and publish only its actual lifecycle.

**How to apply:** implement authenticated matchmaking, occupancy, event
streaming, spectator permissions, and server-owned results only through the
existing authority boundaries, with tests and staging proof for each. Before a
schema push, confirm the database is staging-only; never apply this change to
Production as a side effect of ordinary build or deployment work.

**Migration guard:** The general Drizzle push can propose unrelated progression
enum/default changes. For the asteroid operation foundation, use the reviewed
additive migration only; do not accept broad push prompts or force mode.

**Why:** the inspected full schema plan contained unrelated enum replacement
and economy-default changes, while the operations-only plan could not be
resolved non-interactively.

**How to apply:** apply only the versioned operation migration to the
user-confirmed staging database, then verify the new table/types and API path.
Keep unrelated schema drift for a separately reviewed migration.

**Verification guard:** Keep standalone Solo Flight on its current compatibility
runtime until an orbital migration passes repeatable browser checks for renderer
startup and responsive flight controls. A visible HUD or canvas alone is not
proof that the orbital flight loop initialized.

**Why:** An attempted Solo Flight runtime switch produced inconsistent results
in the headless WebGL flight test, so it was reverted rather than shipping an
unverified control path.

**How to apply:** Before retrying this route, make the orbital renderer and
movement test deterministic in the browser, then repeat it across the supported
mobile-sized viewport.
