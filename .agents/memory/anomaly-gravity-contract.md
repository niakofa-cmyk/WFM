---
name: Anomaly gravity contract
description: Authority, compatibility, and renderer boundaries for live anomaly fields.
---

Live anomaly gravity is a server-issued, versioned environment separate from
free-flight snapshot V1. The server applies it only when every connected pilot
in that shard negotiates support; a legacy client keeps the shard on prior
physics. Client-rendered lensing is visual only, and movement uses the shared
deterministic flight kernel. Keep gravity bounded and nonlethal unless a later
server-owned damage and settlement contract explicitly extends it.

**Why:** Free-flight clients and the API can be deployed independently; adding
movement forces without capability negotiation would make older clients
predict a different trajectory. Local sector rebasing also means the server
field must be translated into the client pilot's current frame.

**How to apply:** When extending environmental effects, keep the payload
versioned outside snapshot V1, negotiate before enabling physics, and never let
the renderer or client choose authoritative field parameters or outcomes.

**Placement rule:** Seeded anomaly lens assemblies must leave clearance around
the fixed Mars and Moon references. Treat the full visible lens plus a safety
margin as part of the occupied space; deterministic sector content must not
render a lens through a planet or moon.

**Why:** The lens is a separate deep-space feature, not a planetary attachment.
An overlap reads as a broken landmark and can make the anomaly appear embedded
in Mars.

**How to apply:** Enforce celestial clearance in the shared server/browser
sector seeder, then test absolute positions across neighboring sector cells.
Do not patch only the renderer, because the gravity center and visual marker
must continue to use the same deterministic location.
