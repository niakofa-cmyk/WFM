---
name: Connected universe and specialist runtimes
description: Owner's current direction connects multiple versioned game experiences through one trusted universe operation network.
---

The current controlling owner source is
`attached_assets/Pasted--MASTER-DEVELOPMENT-DIRECTIVE-WAR-FOR-MARS-INFINITE-WAR_1793803481556.txt`;
the maintained architecture and implementation record is
`docs/infinite-war/ORBITAL-OPERATIONS-NETWORK-FOUNDATION.md`.

**Rule:** WFM is one connected universe with multiple independently operating
experiences. Orbital Combat is the canonical orbital combat runtime; Rust Disc
may retain its specialist flight-simulation runtime behind a versioned
operation adapter. Share universe identity/lifecycle and existing server
authority, not forced-identical physics or duplicate player/economy/reward
systems.

**Why:** the owner clarified that the legacy asteroid-flight experience should
remain a distinct multiplayer side experience inside the overall Infinite War
universe, rather than being erased or forced into Orbital Combat.

**How to apply:** connect modes through explicit location and operation
contracts; preserve runtime/rules versions and migrate client/API/socket
authority together. Never claim a live instance without server evidence.
Preserve no-reward training, replay compatibility, auth, room/reward safeguards,
and rollback.

**Current slice:** Cinder Ring is a server-defined, travelable asteroid, and the
public OON directory advertises its local `flight-sector-v1` training circuit.
Authenticated, single-seat operation registration and an anonymous opt-in status
stream are in workspace code. The additive operation schema is applied to the
user-confirmed staging database; the public directory currently has no active
instances/events until a player registers a session.

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
