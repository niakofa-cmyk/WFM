---
name: Progression synchronization boundary
description: Why background account freshness must not change an issued flight
---

Keep an issued sortie's configuration immutable when refreshing account data
from other sessions. Account changes must reset the previous account's mounted
game state, not reuse it.

**Why:** the server adjudicates the complete replay against its issued ship,
tech and mission configuration. A background refresh must not change those
inputs mid-flight and make a legitimately rendered outcome unverifiable.

**How to apply:** put background profile synchronization at safe non-flight
boundaries, reject obsolete asynchronous responses, and keep device preferences
separate from server-owned progression.
