---
name: Competitive battlefield direction
description: Rules for expanding WFM's aerial battlefield map and competition systems safely.
---

Use the existing simulation's seeded field layouts as the source of in-match map identity. Keep the authoritative seed, chosen field, relay/obstacle geometry, and match result on the server; present that same field in the lobby and flight HUD. Existing private room-code matches remain isolated and no-reward.

**Why:** the user wants the flight competition to expand into a wider, more varied Mars universe. The provided proposals mixed useful goals with fabricated GPS data, incompatible schemas, client-trusted identity/reward inputs, and unsupported settlement paths.

**How to apply:** add map variety through existing simulation state first. Do not add GPS collection, public matchmaking, database tables, or reward eligibility implicitly. A public queue and any associated reward path require separate server-authoritative design and verification. Read `docs/competitive-battlefield.md` and `docs/player-journey-direction.md` before extending this feature.
