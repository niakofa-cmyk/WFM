---
name: Offline universe progression policy
description: Preserve server authority and safe pending-action recovery when connectivity fails.
---

Offline snapshots are read-only. Queue action intents, never entire client-authored world state, credits, rewards, reputation, or unlocks. Keep one unresolved action per account and retain its request identity until server acknowledgement or definitive rejection.

**Why:** the user's supplied architecture includes unsafe local state-sync examples, while the game requires server-owned progression. Queuing dependent spending before earlier outcomes are known risks duplicate charges and misleading offline progress.

**How to apply:** scope journals and snapshots to the authenticated account; keep unknown outcomes pending across reloads; revalidate time-sensitive opportunities and accepted prices on the server. Use existing USSF/Accord identities rather than replacing them with factions from illustrative sample code.

Online wing rooms and server-authorized Strike claims are separate paths. An interrupted online room does not call the Strike claim endpoint; a valid Strike claim after a socket restart could still award its own run's rewards.

**Why:** the Strike endpoint requires a separately issued run ID and replay, so a synthetic claim is not evidence about an interrupted online room and can mutate the test account.

**How to apply:** for online restart checks, verify the UI ends the match, shows the no-rewards notice, and makes no claim request. Test rejected Strike claims only with a genuine expired or otherwise invalid Strike run.
