---
name: Online Wing rewards
description: Owner-approved 5v5 reward amounts, eligibility, and release safeguards.
---

Online Wing rewards use 30 credits for a win, 15 for a draw, and 10 for a loss. A rewarded pilot must be connected at match completion, have at least 60 seconds of server-counted active play and 120 accepted non-neutral controls, with qualifying authenticated human pilots on both opposing teams. Limit rewards to five per account per UTC day. Server-owned match results and idempotent ledger writes are required; local Practice/Solo and all current private room-code matches remain no-reward. Only a trusted server-side competitive queue may mark a room competitive, and awards also require the exact `WFM_WING_REWARDS_ENABLED=true` setting plus the staging database.

**Why:** the owner approved these defaults after reporting that completed 5v5 matches did not consistently increase credits. A client-controlled room mode or an absent reward switch could otherwise expose private/test rooms to unintended awards.

**How to apply:** use the existing progression ledger and profile transaction. Confirm the socket service's database reference is the isolated staging database and synchronize its additive schema before staging verification. `DATABASE_URL` presence alone does not prove the target. Keep current room-code matches private/no-reward; the enable flag by itself is insufficient. Keep Production configuration, data, and deployment untouched until separately authorized.
