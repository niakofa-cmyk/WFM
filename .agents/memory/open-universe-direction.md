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

**How to apply:** build a playable bounded Rust Disc slice before expanding
sectors or considering an engine replacement. Preserve the working Three.js
client, existing room infrastructure and account/progression contracts unless
evidence justifies replacement. Treat source architecture/canon claims as
proposals to check, not proof. Do not represent a local no-reward flight trainer
as an authoritative multiplayer upgrade, persistent discovery or Production
certification. Competitive promotion requires shared verified physics and
versioned networking; client-only completion never authorizes rewards.

**Additional direction:** grow a small connected universe slice with stable
destinations and real server-backed operation discovery before adding broad
procedural scale. Keep the public directory read-only; joins and outcomes must
continue through existing authenticated authority paths.

**Why:** the owner-provided master plan prioritizes a playable, trustworthy
vertical slice over a large but disconnected map.

**How to apply:** expose live operation visibility in navigation, but never
fabricate active pilots, competition status or reward eligibility.

**Live shared-flight requirement:** enemy fleets and authenticated pilot ships must be live 3D actors in the same Orbital free-flight universe, with server-owned movement/combat state. Public presence remains anonymous; exact nearby pilot positions are session-authorized only. Apply [`docs/infinite-war/LIVE-3D-FREE-FLIGHT-PRESENCE-AND-PATROLS.md`](../../docs/infinite-war/LIVE-3D-FREE-FLIGHT-PRESENCE-AND-PATROLS.md) and [`docs/infinite-war/PERSISTENT-ENEMY-FLEET-PATROLS.md`](../../docs/infinite-war/PERSISTENT-ENEMY-FLEET-PATROLS.md). Do not treat the first in-memory movement/snapshot slice as completed combat, persistence or production readiness.

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
