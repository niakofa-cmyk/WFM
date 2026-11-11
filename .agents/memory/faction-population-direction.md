---
name: Faction population and AI escorts
description: Owner-proposed faction ratios, same-faction assistance expectations, and balancing boundaries.
---

The owner proposes adjusting roaming AI force shares to the active human faction
mix. The concrete example is 6 of 10 active human pilots choosing Accord leading
to a target near 80% hostile USSF fleet hulls and 20% friendly Accord AI hulls,
with the rule mirrored for USSF pilots. Friendly AI should assist within the
continuous Orbital universe rather than through a disconnected mode.

The owner also explicitly wants a later allied human and the friendly AI
reserve to approach and help a pilot already fighting multiple hostile fleets.
Friendly traffic merely appearing nearby is not the intended assistance.

This is a direction to evaluate, not approval for production population changes
or new rewards. A deterministic pure mix policy and anonymized process-local
telemetry now exist, but the policy is not connected to fleet spawning.
Cross-owner presence, durable roster accounting, replenishment epochs, and an
AI-escort payout policy remain unspecified.

**Why:** the owner asks to save this faction mix and in-world support concept.

**How to apply:** read
`docs/infinite-war/FACTION-POPULATION-AND-AI-ESCORT-DIRECTION.md` before adding a
balancer or escort role. Keep population metrics authenticated and server-owned,
use the existing persistent fleet/network contracts, preserve pilot reward
attribution, and gate any implementation through deterministic tests and
isolated paired staging. Do not activate the 80/20 target from a single
process's counts. Keep fleet density, encounter frequency, and encounter
intensity as separate controls; never replenish away real casualties, duplicate
leased hulls, or teleport an AI escort beside a battle. See
`docs/infinite-war/ORBITAL-FLEET-POPULATION-AND-ENCOUNTER-DIRECTOR.md` for the
current telemetry/policy boundary and safe rollout order.

**Why:** the owner supplied a specific population-and-threat design. Repository
inspection showed that the current runtime lacks a durable global faction
census and population epoch, so applying the target directly would risk
repeated spawns, duplicate hull counts, and lost casualties.

**How to apply:** first verify cross-owner seat freshness, per-region persistent
hull counts, and active leases. Only then enable bounded, transactional
rebalancing and route-based friendly AI support.
