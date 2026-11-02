---
name: Combat evolution roadmap
description: Owner-supplied WFM combat direction and staged implementation constraints.
---

The owner's full combat-evolution references are retained in
`attached_assets/Pasted-Build-the-WFM-Combat-Evolution-If-I-were-directing-WFM-_1793630574307.txt`
and
`attached_assets/Pasted-Worked-for-1m-33s-WAR-FOR-MARS-HOUSE-OF-THE-DYING-SUN-A_1793630625490.txt`.
See `docs/combat-evolution-roadmap.md` for verified starting state and staged
acceptance gates.

**Why:** the user asked to preserve and implement the full vision. The source
itself advises narrow, testable packages and explicitly says not to expand
campaign, persistent war or procedural content before the core combat slice
works reliably.

**How to apply:** momentum-based 3D flight and host-issued human coordination
orders (Attack, Defend, Escort, Regroup) are now the first two slices. These
orders do not control AI, transfer a human ship, or change combat/reward math.
Design any autonomous units as a new server-owned simulation before adding AI
orders. Continue with eligible cooperative transfer, functional capital
subsystems, objective-driven missions, validated replay variants and only then
strategic world persistence. Keep competitive Wing and its reward contract
separate unless a deliberate migration is designed and tested. Never copy House
of the Dying Sun's protected material. Require deterministic browser/server
parity, idempotent progression and mobile profiling; local checks are not
Production evidence.
