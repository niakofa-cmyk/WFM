---
name: Faction population and AI escorts
description: Owner-proposed faction ratios, same-faction assistance expectations, and balancing boundaries.
---

The owner proposes adjusting roaming AI force shares to the active human faction
mix. The 80% enemy / 20% friendly balance is an adjustable starting example, not
a mandatory final percentage. For example, 6 of 10 active human pilots choosing
Accord could mean 80% hostile USSF fleet hulls and 20% friendly Accord AI hulls;
mirror the factions for a USSF-heavy group. “Enemy” and “friendly” are relative
to the participating pilot/group, so a mixed-faction universe needs local
encounter composition rather than one fixed global ratio. Friendly AI should
assist within the continuous Orbital universe rather than through a disconnected
mode.

The owner also explicitly wants a later allied human and the friendly AI
reserve to approach and help a pilot already fighting multiple hostile fleets.
Friendly traffic merely appearing nearby is not the intended assistance.

Source now includes a cross-owner lease-validated pilot census and a durable,
transactional population epoch balancer. The writer is disabled by default and
staging-only; live Redis Lua behavior and staging convergence are not certified.
It counts active ship hulls, adds bounded route-connected reserve fleets, and
never restores destroyed rosters to force a ratio. AI escort dispatch and any
NPC reward policy remain separate work.

**Why:** the owner clarified that 80% means hostile AI and 20% friendly AI from
the active pilots' faction perspective, while keeping the percentage adjustable.

**How to apply:** read
`docs/infinite-war/FACTION-POPULATION-AND-AI-ESCORT-DIRECTION.md` and
`docs/infinite-war/GLOBAL-AI-POPULATION-EPOCHS.md` before changing the balancer.
Keep its writer off until staging schema, Redis, replica handoff, restart and
casualty checks pass. Keep fleet density, encounter frequency, and encounter
intensity separate; never restore casualties, duplicate leases, or teleport an
AI escort beside a battle. Preserve human reward attribution. The
`docs/infinite-war/ORBITAL-FLEET-POPULATION-AND-ENCOUNTER-DIRECTOR.md` file
describes the separate AI-escort and encounter work.

**Why:** the requested ratio is a target, not permission for destructive roster
changes. Cross-instance presence and a serialized database epoch are required
to avoid double-counts, duplicate fleets and casualty restoration.

**How to apply:** use authenticated Redis seat leases for a fresh faction census
and the PostgreSQL global epoch for additive, bounded persistent formations.
Verify actual staging Redis, database migration and both socket replicas before
enabling the staging flag. Do not enable in Production.
