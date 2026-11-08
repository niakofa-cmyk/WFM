---
name: Open-universe flight direction
description: Owner-supplied vision, original reference and safe staged flight expansion.
---

The owner wants a phone-first space-pilot experience with real vertical flight,
momentum, tactical combat and exploration connected to the existing campaign.
The full source is retained at
`docs/references/wfm-open-universe-flight-vision.md`.
The latest owner-supplied infinite-universe and master game-development
references are retained unchanged in `attached_assets/` and linked from
`docs/infinite-war/INFINITE-UNIVERSE-ORBITAL-RUNTIME-DIRECTION.md`.

**Why:** the owner asked to retain and implement this vision rather than
merely enlarge planar maps or decorate menus.

**How to apply:** keep one Orbital-owned universe, simulation, and authority.
Three.js is the primary renderer for the main universe; native Orbital WebGL2
remains a supported companion renderer. Both present shared state rather than
separate worlds. Follow
`docs/infinite-war/RENDERING-STRATEGY-AND-UNIVERSE-OWNER.md` for the current
renderer decision. Preserve existing room infrastructure and
account/progression contracts. Treat source architecture/canon claims as
proposals to check, not proof. Do not represent a local no-reward flight
trainer as authoritative multiplayer progression or Production certification.
Competitive promotion requires shared verified physics and versioned
networking; client-only completion never authorizes rewards.

**Additional direction:** grow a small connected universe slice with stable
destinations and real server-backed operation discovery before adding broad
procedural scale. Keep the public directory read-only; joins and outcomes must
continue through existing authenticated authority paths.

**Why:** the owner-provided master plan prioritizes a playable, trustworthy
vertical slice over a large but disconnected map.

**How to apply:** expose live operation visibility in navigation, but never
fabricate active pilots, competition status or reward eligibility.

**Architecture rule:** keep public destination presence as anonymous aggregate
counts, while the owner now requires nearby authenticated player ships to be
visible as live 3D actors inside the same shared Orbital free-flight session.
Exact poses belong only to authorized participants in a bounded spatial
interest group, never to public lookup APIs. Preserve existing combat runtimes
as compatibility/rollback adapters until parity is proven.

**Why:** the owner explicitly clarified that both opposing fleets and pilots
must patrol visibly in live 3D free flight; aggregate-only presence does not
satisfy the intended in-world multiplayer experience.

**How to apply:** make the server own movement, pose, faction, and encounter
state; distribute short-lived snapshots only to nearby authenticated flight
participants. Keep public discovery read-only and anonymous. Do not fabricate
ships or claim continuous shared flight until multi-client server-owned
positions and encounter results are verified.

**Correction:** authenticated multiplayer exploration is intended to be
server-authoritative and reward-capable, including confirmed enemy-hull tallies.
The no-reward rule belongs to the offline local sandbox and remains separate
from the shared universe.

**Why:** the user explicitly corrected the earlier overbroad no-reward
interpretation and made dynamic faction encounters and rewarded exploration a
foundational rebuild requirement.

**How to apply:** use
`docs/infinite-war/DYNAMIC-FACTION-ENCOUNTERS-AND-EXPLORATION-AUTHORITY.md`.
Validate encounter state, ship destruction, reward eligibility, and world
consequences on the server with idempotent settlement. Do not alter existing
Wing, private-room, AI-fill, or local-sandbox reward rules by implication.

**Owner clarification:** the pilot's selected faction determines the opposing
roaming patrol faction; server-confirmed destroyed patrol ships must change the
shared universe roster, while only completed extraction earns the bounded
exploration bounty.

**Why:** the owner explicitly wants exploration itself to be authoritative,
combat-capable, reward-capable, and consequential across the open universe.

**How to apply:** resolve patrol and player location from authenticated saved
world state, reserve a fleet for one encounter, attribute damage and assists
from server simulation, and settle casualties/rewards idempotently. Aborted
encounters must not pay credits. Do not infer human players or a seamless
continuous-world battle from a strategic AI patrol.

**Continuous-flight rule:** when a streamed sector origin changes, translate the
camera and other local presentation state by the same local-frame offset as the
pilot. Keep the deployment anchor in sector-plus-local coordinates and show a
compact return range/vector; never snap or redirect the camera at a boundary.

**Why:** the owner explicitly wants pilots to continue flying outward and
physically return across the traveled distance, with spatial awareness but no
forced camera framing.

**How to apply:** preserve the active deterministic flight step and exact
integer sector address. Do not convert unbounded sector integers to floating
point for authority, persist client-only location as account state, or apply
radiation/hull effects without a versioned server-owned rule.

**Concurrent battle authority:** keep each persistent fleet's encounter rights
and settlement separate even when several fleets fight in one rendered scene.
Pilot combat state is participant-scoped, not a session-wide switch.

**Why:** seamless presentation must not let one patrol's completion disable
another pilot's battle, authorize bystander damage, or change reward ownership.

**How to apply:** check the shooter/victim relationship before applying damage,
and derive each recipient's remaining combat state from that pilot's active
encounters. Treat live shared-flight tests and deployed staging evidence as
separate verification gates.
