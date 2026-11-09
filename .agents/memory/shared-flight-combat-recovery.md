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

Approach/aim diagnostics must compare positions and headings from the same
coordinate frame.

**Why:** a staging driver used server target bearings with local yaw after
rejoin; the different headings prevented a reliable approach and could have
been misreported as an encounter failure.

**How to apply:** use server-space geometry with server heading for network
diagnostics, and verify the renderer/prediction frame separately. Do not inject
poses or weaken engagement range to make an automated approach succeed.

Encounter participation and the pilot's ability to act are separate states:
an ongoing fleet battle can include a destroyed participant.

**Why:** acknowledging controls for a craft skipped by the simulation appears
like lost weapon traffic, especially if a freshly initialized local HUD still
shows full health.

**How to apply:** display authoritative own-pilot health/life, reject disabled
weapon intent explicitly, and measure accepted intent, emitted projectiles and
impacts separately. Never infer a shot from an acknowledgement or revive a
pilot locally to make a firing test pass.

Total wing defeat must resolve as a server-owned, zero-credit aborted result,
not remain active forever waiting for every enemy to die. A surviving ally
keeps the encounter live; destroyed participants cannot recover until all their
outstanding encounter results have settled.

**Why:** requiring completed settlement for recovery revealed that enemy-only
victory detection leaves defeated wings permanently unable to recover.

**How to apply:** retain real attribution in the existing idempotent ledger,
never manufacture a victory or completion reward, and fail recovery closed
when the durable result cannot be recorded. Distinguish disconnect retention
within one process from restart-durable hull persistence.

A cleared authoritative contact list is a valid completion state, not a request
to restore local preview traffic.

**Why:** a successful fleet settlement left a phantom local patrol notice after
the server roster had cleared, despite the flight remaining healthy.

**How to apply:** keep local-training previews separate from shared-world
presentation. Connecting, unavailable and empty shared snapshots cannot confer
authority on cached preview contacts. Clear completed battle notices without
revoking controls for a different encounter that is still active.

Apply that separation to the server roster too: a configured persistent patrol
directory returning empty or failing must not produce compatibility/sample
enemies. Later admissions should retry the durable lookup without resetting
existing pilots, casualties, attribution or battle contracts.

**Why:** paired staging flight showed hostile sample ships but no persistent
hostile contact that could be reserved. A lookup restricted to session creation
also left an initially empty session unable to discover later durable patrols.

**How to apply:** fail closed for persistent combat authority while leaving
flight available; add newly resolved durable fleets idempotently, and verify
the snapshot roster rather than inferring authority from a hostile HUD count.
