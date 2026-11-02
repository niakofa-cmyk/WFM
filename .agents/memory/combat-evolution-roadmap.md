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
and its reward contract separate. Next work should validate balance, mobile
readability/performance, multiplayer interruption recovery, and staging behavior
before expanding systems or enabling this feature in Production. Pilot transfer
is still out of scope. Never copy House of the Dying Sun's protected material.
Require deterministic browser/server parity and idempotent progression; local
checks are not Production evidence.
