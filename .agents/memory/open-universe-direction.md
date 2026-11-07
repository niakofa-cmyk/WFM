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

**How to apply:** keep Orbital as the intended sole game engine/runtime and do
not expand a separate Three.js universe. The current renderer is transitional;
do not claim the Orbital-only renderer migration is complete until verified.
Preserve existing room infrastructure and account/progression contracts. Treat
source architecture/canon claims as proposals to check, not proof. Do not
represent a local no-reward flight trainer as authoritative multiplayer
progression or Production certification. Competitive promotion requires shared
verified physics and versioned networking; client-only completion never
authorizes rewards.

**Additional direction:** grow a small connected universe slice with stable
destinations and real server-backed operation discovery before adding broad
procedural scale. Keep the public directory read-only; joins and outcomes must
continue through existing authenticated authority paths.

**Why:** the owner-provided master plan prioritizes a playable, trustworthy
vertical slice over a large but disconnected map.

**How to apply:** expose live operation visibility in navigation, but never
fabricate active pilots, competition status or reward eligibility.

**Architecture rule:** maintain one persistent universe layer for destinations,
server-owned travel and short-lived player presence. The latest master directive
targets one Orbital main engine; preserve existing combat runtimes as explicit
migration/rollback adapters until parity is proven. Surface live activities from real operation
instances; publish presence only as anonymous destination-level counts, never
player identities or exact coordinates.

**Why:** the owner explicitly wants a shared multiplayer ecosystem without
forcing every battle system into one simulation or destabilizing the open-world
layer.

**How to apply:** send heartbeats only while the pilot is in universe
navigation; derive locations from saved world state, expire leases quickly, and
stop updates when an operation starts. Keep discovery/event feeds read-only.
Do not claim shared continuous 3D flight or nearby ship positions until those
systems are actually implemented and verified.

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
