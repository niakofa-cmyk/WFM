---
name: Shared target-lock handoff
description: Preserve authoritative missile-lock transitions when server-selected targets change.
---

When a pilot switches targets, the selected actor identity is authoritative, but the native simulation must still see that it differs from the previous lock identity. Do not overwrite both identities at selection time: leave the prior native lock ID intact, reset displayed progress, and let the normal simulation update detect the switch and clear stale charge before advancing a new lock.

**Why:** Setting the selected and native target IDs to the new actor at once hides the transition from the existing lock-acquisition code. A fully charged lock can then appear continuous after target selection changes.

**How to apply:** Any server or client operation that changes the enemy used by the native missile solver must invalidate old lock charge and prove the previous target cannot launch after the switch.
