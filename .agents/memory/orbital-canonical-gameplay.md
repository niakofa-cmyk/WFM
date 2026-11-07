---
name: Canonical Orbital engine and migration adapters
description: One main Orbital engine is the target; existing runtimes remain explicit compatibility paths until verified migration.
---

Earlier owner reconstruction references are
`attached_assets/Pasted-War-for-Mars-Infinite-War-Updated-Repository-Forensic-E_1793842864923.txt`
and `attached_assets/Pasted--WAR-FOR-MARS-INFINITE-WAR-MASTER-AI-GAME-DEVELOPMENT-P_1793842908766.txt`.
Earlier owner direction is preserved in
`attached_assets/Pasted--War-for-Mars-Infinite-War-The-Infinite-Open-Universe-I_1793989681065.txt`,
`attached_assets/Pasted--War-for-Mars-Infinite-War-Orbital-Combat-Lab-Infinite-_1793990090269.txt`,
`attached_assets/Pasted--WAR-FOR-MARS-THE-INFINITE-WAR-structural-rebuild-strat_1793990237240.txt`,
and `attached_assets/Pasted--War-for-Mars-Infinite-War-Multiplayer-Universe-Archite_1793990650366.txt`.
The earlier repository audit is historical at
`docs/infinite-war/UPDATED-REPOSITORY-FORENSIC-EVALUATION.md`; follow the newer
maintained roadmap and asteroid-hub contract for current implementation.
The newest controlling source and its one-main-engine precedence are recorded
in [master development directive](master-development-directive.md).

**Rule:** One Orbital engine must own the finished game's rendering and gameplay
runtime, with specialist experiences connected through adapters. Three.js is a
reference for techniques only, not a library to ship in the finished game. The
current repository still uses it for rendering and has no complete Orbital-native
renderer, so remove it only after a replacement passes feature, performance,
authority, and rollback gates. Preserve existing identity, matchmaking, economy,
progression, reward services, and working compatibility paths during migration.

**Why:** the owner explicitly corrected the renderer decision: the game's scale
requires one Orbital rendering and simulation foundation, while repository
inspection shows that Three.js currently supplies the only working 3D renderer.
The migration must honor the target without breaking the current game prematurely.

**How to apply:** follow
`docs/infinite-war/ORBITAL-ENGINE-ONLY-RENDERER-REBUILD.md` for the audited
current state and renderer removal gates. Build an Orbital-owned renderer proof,
then migrate and test one surface/mode at a time. Use explicit operation
adapters; version network/replay contracts and change client/API/socket
authority together. The local Cinder approach cannot authorize a queue or create
an operation. Retain Wing's server-owned competitive and reward gates.

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

**Owner-reported verification:** The user confirmed that the local Cinder
approach worked correctly at 22 m; the device and runtime were not specified.

**Why:** this confirms the corrected local approach behavior, but does not
establish Android, staging, persistent-location or multiplayer verification.

**How to apply:** retain the 22 m local docking approach as a user-confirmed
behavior while keeping platform and authority claims limited to separately
verified evidence.

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

**Verification guard:** Standalone Solo Flight now uses canonical `orbital-v5`
after its browser gate passed. Preserve checks for actual runtime identity,
renderer startup, control-driven movement, and landscape touch controls. Browser
evidence is not physical Android certification.

**Why:** An earlier runtime switch produced inconsistent headless WebGL results.
The route stayed on compatibility until repeatable desktop and phone-sized
browser checks verified the Orbital flight loop and responsive controls.

**How to apply:** Keep both browser checks passing when changing Solo Flight's
renderer or input mapping. Record Android device verification separately and
never report browser automation as a physical-device pass.
