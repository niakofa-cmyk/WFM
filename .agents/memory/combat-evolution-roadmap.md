---
name: Combat evolution roadmap
description: Owner-supplied WFM combat direction and staged implementation constraints.
---

The owner's full combat-evolution references are retained in
`attached_assets/Pasted-Build-the-WFM-Combat-Evolution-If-I-were-directing-WFM-_1793630574307.txt`
and
`attached_assets/Pasted-Worked-for-1m-33s-WAR-FOR-MARS-HOUSE-OF-THE-DYING-SUN-A_1793630625490.txt`.
See `docs/combat-evolution-roadmap.md` for verified starting state and staged
acceptance gates. The first integrated combat vertical slice is Operation Iron
Eclipse: vector-drift 3D flight, a server-owned AI wing, host tactical orders,
functional capital systems, extraction objectives, and zero-credit discovery
persistence through the existing cooperative-sector system.

**Why:** the user asked to preserve and implement the full vision. The source
itself advises narrow, testable packages and explicitly says not to expand
campaign, persistent war or procedural content before the core combat slice
works reliably.

**How to apply:** keep Iron Eclipse state, AI movement and damage, subsystem
effects, command permissions, and mission resolution on the authenticated
server. Reuse the existing account-scoped zero-credit discovery event; do not
create a parallel reward ledger or player/session schema. Keep competitive Wing
and its reward contract separate. As of 2026-11-03, the current flight and
performance revision is deployed to the dedicated Railway staging app, API, and
socket services from the same staging revision. Railway reports all three
services and PostgreSQL online, with no pending deployments or recent failures.
This confirms deployment and service health only: frame pacing, co-op RTT, and
the authenticated mission flow still need an Android phone check on this
revision. Next, use the in-game performance HUD during an authenticated staging
flight, then complete a co-op mission that verifies shared flight, squad
commands, capital-defense state, extraction, and the zero-credit result. The
two staging feature switches are enabled, while Production remains untouched.
Pilot transfer is still out of scope. Never copy House of the Dying Sun's
protected material. Require deterministic browser/server parity and idempotent
progression; local checks are not Production evidence.

For flight-performance work, keep simulation and collision decisions
deterministic and byte-identical in browser and server copies. Reduce hot-loop
allocation and rendering cost before lowering network authority, simulation
frequency, or gameplay detail; server ownership and the existing input/snapshot
cadence are not performance knobs to weaken casually. Treat code-level
optimizations as hypotheses until frame-interval data from actual Android play
confirms the experience improved.

The flight diagnostic HUD reports local animation-frame cadence, approximate
P95 frame interval, long frames, adaptive render scale, and (for authenticated
co-op) an echoed WebSocket RTT. It does not persist or upload telemetry. Adaptive
resolution may only alter rendering; never use client timing to change
simulation, collision, rewards, or authoritative input cadence. Follow
`docs/wfm-flight-performance.md` for the device-check protocol.

**Why:** a successful build and healthy services do not prove mobile rendering,
live authentication, multiplayer synchronization, mission completion, or
progression behavior on the deployed revision. Lower-allocation simulation can
reduce garbage-collection pauses, but only representative device measurements
can confirm whether GPU load, network timing, thermal throttling, or another
runtime bottleneck remains.

**How to apply:** keep the next test on the staging host and use authenticated
accounts only. Do not turn on Wing rewards or promote any setting to Production
as part of this mission test. Capture frame intervals and note whether stalls
coincide with combat/projectile density or network reconnects; distinguish
browser frame cadence from GPU timing and server/network latency.
