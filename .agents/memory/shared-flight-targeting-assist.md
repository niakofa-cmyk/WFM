---
name: Shared-flight targeting and wing calls
description: Visible lock markers track server-selected targets; help calls invite nearby same-faction pilots into the same live battle.
---

Render the selected hostile's server snapshot at its projected location, with an on-screen reticle and an edge bearing when it leaves the viewport. Keep lock progress and missile readiness separate: the server's weapon solver still owns range, aim, line-of-sight, ammo, and cooldown.

**Why:** A target status box alone does not show which visible ship is selected or where to point for direct fire.

**How to apply:** Drive the marker from the authenticated selected actor and current shared-flight snapshot. Never let a client-supplied position or target ID authorize damage.

Wing support calls are invitations to nearby authenticated same-faction pilots in the same spatial session, not a separate co-op mode and not automatic NPC backup. Accepting must revalidate the active encounter, location, faction, range, invite, and capacity, then join the same server encounter without another reservation.

**Why:** The owner wants a pilot to call for nearby human help during a live open-universe battle while keeping all participants and consequences in one continuous universe runtime.

**How to apply:** Keep call creation, recipient selection, expiry, rate limits, battle membership, and settlement server-owned. A call or acceptance by itself never grants damage, kills, assists, or rewards.

Prioritize nearby hostile threats when extending target selection, but preserve the pilot's chosen target while flying rather than continually replacing it with whichever enemy becomes closer.

**Why:** The owner wants closest-enemy selection and useful cycling during multi-fleet combat, without losing deliberate aim or missile charge unexpectedly.

**How to apply:** Keep explicit nearest selection distinct from maintaining an existing lock; proximity does not override server combat eligibility.
