---
name: Economy concurrency evidence
description: Avoid vacuous concurrency certificates when all simulated purchases are unaffordable.
---

Concurrency scenarios must force a mix of accepted and rejected writes and verify conservation of credits, inventory, and shared stock across accounts.

**Why:** the supplied economy sample gives a test account too few credits to buy even one requested batch. Ten rejected orders with no negative balances would not prove atomicity or double-spend protection.

**How to apply:** seed sufficient funds, deliberately constrain stock or shared cargo capacity, and assert exact acceptance counts and ledger totals against the real database. Treat synthetic tests as development evidence, not proof of production or real-network behavior.
