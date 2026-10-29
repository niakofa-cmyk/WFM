---
name: Online Wing rewards
description: Owner-approved 5v5 reward amounts, eligibility, and release safeguards.
---

Online Wing rewards use 30 credits for a win, 15 for a draw, and 10 for a loss. A rewarded pilot must be connected at match completion, have at least 60 seconds of server-counted active play and 120 accepted non-neutral controls, with qualifying authenticated human pilots on both opposing teams. Limit rewards to five per account per UTC day. Server-owned match results and idempotent ledger writes are required; local Practice/Solo remains no-reward.

**Why:** the owner approved these defaults after reporting that completed 5v5 matches did not consistently increase credits.

**How to apply:** use the existing progression ledger and profile transaction. Confirm the socket service's database reference is the isolated staging database and synchronize its additive schema before staging verification. `DATABASE_URL` presence alone does not prove the target. Keep Production configuration, data, and deployment untouched until separately authorized.
