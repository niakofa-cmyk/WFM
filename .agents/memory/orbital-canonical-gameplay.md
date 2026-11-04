---
name: Canonical orbital gameplay
description: Owner's full-game directive to migrate every WFM mode onto one versioned orbital simulation.
---

The controlling owner source is
`attached_assets/Pasted--WAR-FOR-MARS-THE-INFINITE-WAR-MASTER-ORBITAL-ENGINE-CO_1793798261341.txt`;
the maintained implementation plan is
`docs/infinite-war/ORBITAL-ENGINE-CONSOLIDATION-DIRECTIVE.md`.

**Rule:** WFM is one game on one canonical orbital flight/combat simulation.
Combat Lab is the offline, no-reward test harness for that engine, not an
isolated end state. Rust Disc, Arcade, every campaign sortie, sector co-op, Iron
Eclipse, private/AI-fill rooms, competitive Wing, and future fleet operations
must migrate to the same rules. Keep existing Clerk, matchmaking, mission,
Galaxy, economy, Armory, progression, reward and idempotency authority in their
current server-owned systems.

**Why:** the owner explicitly clarified that the entire game—not only Contact or
the Combat Lab—must use the new orbital gameplay foundation.

**How to apply:** migrate actual mode behavior in coordinated, versioned
client/API/socket slices. Never toggle the renderer alone or silently change an
issued run. Preserve no-reward local training, legacy replay compatibility,
reward and room safeguards, and rollback until each mode passes its acceptance
gate. Do not claim full-game consolidation until every mode's real gameplay and
authority path is verified.

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
