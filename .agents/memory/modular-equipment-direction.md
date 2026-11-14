---
name: Modular military equipment direction
description: Why WFM equipment must preserve military hull compatibility and physical ownership.
---

Build a modular military ecosystem, not generic collect-and-replace weapons.
Different hulls require compatible primary, secondary, special, defensive and
utility hardpoints. Respect physical size, mass, reactor demand and equipment
condition. A small fighter cannot automatically mount a capital-class cannon.

**Why:** The creator explicitly wants ship class and military character preserved,
with recovered enemy equipment becoming usable only when a pilot's hull can
actually support it.

**How to apply:** Extend the existing armory and authoritative shared-flight
systems, not a parallel equipment demo. Keep recovered hardware account-owned
and require verified server combat provenance. Preserve normalized competition
and the established immutable issued-flight boundary. See
`docs/infinite-war/MODULAR-MILITARY-EQUIPMENT.md` for rollout and scope.

Physical wreck recovery and hangar-ledger recovery are two ways to recover the
same package, never separate loot grants. A wreck may be visible at destruction
but becomes recoverable only after kill ownership is durably settled. Recovery
adds equipment to the locker; it does not refit the craft during combat.

**Why:** A visible explosion alone is not a settled equipment entitlement, and
simultaneous hangar/spatial claims must not duplicate military hardware or
violate the immutable issued-flight boundary.

**How to apply:** Preserve the shared provenance identity and transaction
boundary when adding future cargo, recovery animations or wreck navigation.

Live equipment appearance must follow the server-issued flight loadout, not
an editable Armory draft. Public appearance must not expose inventory instance
identities or cargo.

**Why:** changing a draft during flight must not change the military equipment
other pilots believe a ship carries, or leak the owner's private inventory.

**How to apply:** derive public fittings from issued authoritative state,
clear stale appearances across reconnect/session changes, and keep appearance
separate from weapon authority and exact salvage provenance.

Acquisition must support combat salvage, exploration/scanning, and derelict or
installation discoveries; kills must not be the only equipment source.
Separate durable equipment from energy cells, ammunition and crafting resources.
For enemy salvage, recoverable hardware must come from that enemy's actual
issued equipment and validated destruction state, not an unrelated loot pool.

**Why:** the creator supplied the complete weapon-acquisition reference to make
exploration meaningful and connect visible enemies, military equipment and
progression. A unique human-owned item must not be cloned or lost on a PvP kill
without an explicit loss/transfer policy.

**How to apply:** follow
[the acquisition directive](../../docs/infinite-war/WEAPON-ACQUISITION-AND-EXPLORATION-DIRECTIVE.md),
keep one authoritative manifest for firing/appearance/salvage, preserve legacy
claims, and treat illustrative acquisition percentages as proposals rather than
drop rates or faction-population settings.

Keep the existing one kill-owned equipment package per wreck until multi-item
allocation, cargo capacity and assist-sharing policy are deliberately designed.
Unknown new provenance must not fall back to historical random catalog loot.

**Why:** connecting real enemy equipment should not silently multiply rewards,
change ownership policy, or describe unrelated legacy loot as recovered hardware.

**How to apply:** preserve old claims verbatim, version new evidence, and widen
allocation only alongside an explicit economy/ownership decision.
