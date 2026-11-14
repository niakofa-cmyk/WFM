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
transactional population epoch balancer. The writer remains off by default and
is enabled only in WFM staging; two-device convergence is not yet certified. It
counts active ship hulls, adds bounded route-connected reserve fleets, and never
restores destroyed rosters to force a ratio. A nearby persistent friendly patrol
can join a battle as bounded AI support; its casualties are settled with the
same encounter receipt and do not create human kill credit.

Each materialized location also receives one persistent route-security
formation per faction alongside the route-roaming formation. The local patrol
prevents waypoint travel from leaving a location empty, while keeping its ships
and casualties persistent.

**Why:** a route-roaming fleet can be away from its origin for multiple
waypoint intervals, and free flight previously loaded only fleets at the exact
current location.

**How to apply:** seed local route-security patrols additively and let them
continue tactical flight movement. Never heal or recreate ships already
destroyed; reserve reinforcements must use new persistent identities.

**Why:** the owner clarified that 80% means hostile AI and 20% friendly AI from
the active pilots' faction perspective, while keeping the percentage adjustable.

**How to apply:** read
`docs/infinite-war/FACTION-POPULATION-AND-AI-ESCORT-DIRECTION.md` and
`docs/infinite-war/GLOBAL-AI-POPULATION-EPOCHS.md` before changing the balancer.
Keep its writer off until staging schema, Redis, replica handoff, restart and
casualty checks pass. Keep fleet density, encounter frequency, and encounter
intensity separate; never restore casualties, duplicate leases, or teleport an
AI escort beside a battle. Preserve human reward attribution. The
`docs/infinite-war/ORBITAL-FLEET-POPULATION-AND-ENCOUNTER-DIRECTOR.md` and
`docs/infinite-war/ROUTE-BASED-FRIENDLY-PATROL-SUPPORT.md` describe the
encounter and friendly-patrol contracts.

**Why:** the requested ratio is a target, not permission for destructive roster
changes. Cross-instance presence and a serialized database epoch are required
to avoid double-counts, duplicate fleets and casualty restoration.

**How to apply:** use authenticated Redis seat leases for a fresh faction census
and the PostgreSQL global epoch for additive, bounded persistent formations.
Treat Redis time as authoritative for lease pruning, but measure census age from
local receipt time so different socket-host clocks cannot reject a fresh read.
Verify two authenticated pilots across both staging replicas before claiming
convergence. Do not enable in Production.

**Why:** staging telemetry showed fresh population reads rejected as stale when
the epoch guard compared Redis and socket absolute clocks across hosts.

**How to apply:** preserve the Redis-side 20-second lease freshness check, and
use the receiving process's timestamp only for local elapsed-time validation.
An empty census is not evidence that a shared multiplayer population has been
verified.
