---
name: Offline universe progression policy
description: Preserve server authority and safe pending-action recovery when connectivity fails.
---

Offline snapshots are read-only. Queue action intents, never entire client-authored world state, credits, rewards, reputation, or unlocks. Keep one unresolved action per account and retain its request identity until server acknowledgement or definitive rejection.

**Why:** the user's supplied architecture includes unsafe local state-sync examples, while the game requires server-owned progression. Queuing dependent spending before earlier outcomes are known risks duplicate charges and misleading offline progress.

**How to apply:** scope journals and snapshots to the authenticated account; keep unknown outcomes pending across reloads; revalidate time-sensitive opportunities and accepted prices on the server. Use existing USSF/Accord identities rather than replacing them with factions from illustrative sample code.
