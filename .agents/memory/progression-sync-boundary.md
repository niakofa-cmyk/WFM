---
name: Progression synchronization boundary
description: Why background account freshness must not change an issued flight
---

Keep an issued sortie's configuration immutable when refreshing account data
from other sessions. Account changes must reset the previous account's mounted
game state, not reuse it.

ARC/STRAFE and the selected hull/faction are account-scoped preferences and
should persist through the authenticated player profile; gyro remains device-local. The drilled flag is
profile-backed with a device-local fallback, so do not group it with gyro as
strictly device-local. Saving the control scheme must not increment progression
revision, which binds issued reward claims.

**Why:** the server adjudicates the complete replay against its issued ship,
tech and mission configuration. A background refresh must not change those
inputs mid-flight and make a legitimately rendered outcome unverifiable. The
control scheme was only being held in client state until a Strike started, so
sign-in changes could discard a user's selection.
The owner has since confirmed gyro should remain device-local; do not move it
into the player profile without a new explicit decision.
The owner also observed selected hulls reverting after leaving the Armory:
local-only choices were replaced by the profile freshness check. Keep an
uncommitted Armory draft separate from refreshed profile data, and acknowledge
selection only after its authenticated save succeeds. Back must not silently
discard or pretend to save a failed selection.

**How to apply:** put background profile synchronization at safe non-flight
boundaries, reject obsolete asynchronous responses, and keep device preferences
separate from server-owned progression. Persist account-scoped control choices
through the authenticated profile API without changing progression revision.
Apply the same revision rule to hull/faction preferences: already-issued
sorties retain their original immutable configuration.
