---
name: Practice reward boundary
description: Distinguish signed-in WarApp Practice from the local no-reward Solo Flight test route.
---

Signed-in WarApp Practice is server-authorized and may award credits when its replay completes. It is not the no-reward physical-control test. The separate local Solo Flight route at `/play` explicitly does not save campaign progress or award rewards.

**Why:** On 2026-10-27, a staging Android tester completed signed-in Practice and reported a debrief showing six kills, two relays, 172 credits, no crate, and a 300 CR balance. Source inspection confirms the authenticated run submits its replay; no HTTP claim response or reward-ledger read was captured.

**How to apply:** For no-reward device checks, use `/play` and verify its local/no-reward notice. If using signed-in Practice, treat it as a potentially reward-mutating staging run and require explicit reward-test authorization. Never advise a second flight or retry to resolve an unexpected credit display.
