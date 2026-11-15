---
name: Player journey direction
description: The user's product direction for the WAR FOR MARS player experience and future feature work.
---

Use `docs/player-journey-direction.md` as the concise reference, and preserve the original user-provided source document in `attached_assets/`. Evaluate future work by whether it connects or improves the end-to-end player journey: understand the conflict and modes, choose/refit a ship, fight readable battles, receive trusted progression, use rewards, and explore meaningful new opportunities.

**Why:** the user asked that this document guide the initial game and ongoing improvements, emphasizing a complete player journey over additional disconnected screens or code.

**How to apply:** before implementing a feature, identify the journey step it improves and how it will be validated. Describe aspirational universe features as future direction unless they are already implemented and verified.

## Universe and economy acceptance direction

Each location should have a distinct purpose and activities. Trade goods should have meaningful uses in ship progression; station services, salvage, and contracts should connect to that loop. Faction reputation should have consequences, and world events should affect opportunities and the economy. Backend outages must have clear recovery behavior rather than silently substituting local progression.

**Why:** the user specified these as completion requirements when asking to verify the expanded persistent universe and shared economy.

**How to apply:** distinguish persisted counters, labels, and screens from playable activities and consequences. Verify server-owned transactions and recoverable outcomes as well as the player's end-to-end use of materials and upgrades.
