---
name: Progression synchronization boundary
description: Why background account freshness must not change an issued flight
---

Keep an issued sortie's configuration immutable when refreshing account data
from other sessions. Account changes must reset the previous account's mounted
game state, not reuse it.

ARC/STRAFE is an account-scoped control preference and should persist through the
authenticated player profile; gyro and drilled preferences remain device-local.
Saving the control scheme must not increment progression revision, which binds
issued reward claims.

**Why:** the server adjudicates the complete replay against its issued ship,
tech and mission configuration. A background refresh must not change those
inputs mid-flight and make a legitimately rendered outcome unverifiable. The
control scheme was only being held in client state until a Strike started, so
sign-in changes could discard a user's selection.

**How to apply:** put background profile synchronization at safe non-flight
boundaries, reject obsolete asynchronous responses, and keep device preferences
separate from server-owned progression. Persist account-scoped control choices
through the authenticated profile API without changing progression revision.
