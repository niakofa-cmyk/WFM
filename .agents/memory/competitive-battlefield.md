---
name: Competitive battlefield direction
description: Rules for expanding WFM's aerial battlefield map and competition systems safely.
---

Use the existing simulation's seeded field layouts as the source of in-match map identity. Keep the authoritative seed, chosen field, relay/obstacle geometry, and match result on the server; present that same field in the lobby and flight HUD. Private room-code matches remain isolated and no-reward. Keep the opt-in competitive queue at ten distinct authenticated humans with no AI seats. Casual AI-fill is a separate unranked, no-reward queue: each newly accepted pilot resets a 30-second server countdown, after which AI fills open seats.

**Why:** the user wants the flight competition to expand into a wider, more varied Mars universe. The provided proposals mixed useful goals with fabricated GPS data, incompatible schemas, client-trusted identity/reward inputs, and unsupported settlement paths.

**How to apply:** add map variety through existing simulation state first. Keep both queues behind separate exact frontend and socket opt-in flags until single-process staging routing and live behavior are verified. Assign casual AI-fill only on the server; never make it competitive or reward-eligible. Competitive mode comes only from ten-human queue assignment; rewards remain separately gated by the reward flag and staging database. No GPS collection or one-room global free-for-all. Read `docs/competitive-battlefield.md` and `docs/player-journey-direction.md` before extending this feature.
