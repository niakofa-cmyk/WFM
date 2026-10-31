---
name: Online Wing rewards
description: Owner-approved 5v5 reward amounts, eligibility, and release safeguards.
---

Online Wing rewards use 30 credits for a win, 15 for a draw, and 10 for a loss. A rewarded pilot must be connected at match completion, have at least 60 seconds of server-counted active play and 120 accepted non-neutral controls, with qualifying authenticated human pilots on both opposing teams. Limit rewards to five per account per UTC day. Server-owned match results and idempotent ledger writes are required; local Practice/Solo, private room-code matches, and Casual AI-fill matches are no-reward. Competitive queue starts only with ten distinct authenticated humans; Casual AI-fill has a separate 30-second reset-on-entry queue and can never settle rewards. Both queues are independently gated from rewards.

**Why:** the owner approved these defaults after reporting that completed 5v5 matches did not consistently increase credits. A client-controlled room mode or an absent reward switch could otherwise expose private/test rooms to unintended awards.

**How to apply:** use the existing progression ledger and profile transaction only for eligible competitive outcomes. Confirm the socket service's database reference is the isolated staging database and synchronize its additive schema before staging verification. `DATABASE_URL` presence alone does not prove the target. Keep private room-code and Casual AI-fill matches no-reward; queue enablement and reward enablement are separate. Keep Production configuration, data, and deployment untouched until separately authorized.

## Interpreting an empty reward ledger

Zero duplicate groups or arithmetic mismatches over zero matching reward events is not a successful reward-integrity certification. An empty ledger means positive settlement has not been demonstrated; it does not establish whether an eligible settlement was attempted or why no event was written.

**Why:** the 2026-10-31 staging readback found the `wing_reward` enum but no `online-wing` reward rows, making duplicate and balance-delta checks vacuous.

**How to apply:** require at least one controlled, eligible staging settlement with a corresponding ledger event before treating award, idempotency, or arithmetic behavior as verified. Keep claim-denial evidence as a separate gate.
