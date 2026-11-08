---
name: Shared-flight combat recovery
description: Preserve authoritative battle controls across reconnects, secondary requests and stale fleet contacts.
---

Flight-position snapshots are not sufficient to restore battle participation.
Rejoining pilots need the server's current aggregate encounter phase and seat
tally. A request to join another fleet, or its rejection, must not revoke an
already-active battle's controls.

**Why:** staging showed hostile weapon traffic while the client lacked its fire
control. Source review found both missing encounter-state rehydration on rejoin
and secondary request/error status replacing the active HUD phase.

**How to apply:** keep request notices separate from authoritative participation.
Only server phase changes may activate or revoke combat controls; reconnect
restores state without creating a fresh encounter or applying results twice.

A visible strategic fleet may move or change before its durable reservation is
claimed. Refresh rejected idle contacts rather than assuming the old visible
roster remains available. Do not replace active contracts, import another saved
location's fleets, steal an existing lease, or bypass settlement.

**Why:** strategic movement and shared-flight rendering have different update
cadences; stale visibility is not permission to reserve or reward a fleet.

**How to apply:** serialize claim/revalidation/refresh and preserve existing
active contracts. Treat a nearby station name as a docking target, not proof
that the pilot's canonical world location changed.
