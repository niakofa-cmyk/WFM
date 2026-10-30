---
name: Competitive battlefield direction
description: Rules for expanding WFM's aerial battlefield map and competition systems safely.
---

Use the existing simulation's seeded field layouts as the source of in-match map identity. Keep the authoritative seed, chosen field, relay/obstacle geometry, and match result on the server; present that same field in the lobby and flight HUD. Private room-code matches remain isolated and no-reward. The user approved an opt-in competitive queue that waits for ten distinct authenticated human pilots, then starts a balanced 5v5 without AI seats.

**Why:** the user wants the flight competition to expand into a wider, more varied Mars universe. The provided proposals mixed useful goals with fabricated GPS data, incompatible schemas, client-trusted identity/reward inputs, and unsupported settlement paths.

**How to apply:** add map variety through existing simulation state first. Keep the queue behind exact frontend and socket opt-in flags until single-process staging routing and live ten-human behavior are verified. Competitive mode comes only from server queue assignment; rewards remain separately gated by the reward flag and staging database. No GPS collection or one-room global free-for-all. Read `docs/competitive-battlefield.md` and `docs/player-journey-direction.md` before extending this feature.
