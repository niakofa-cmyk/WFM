---
name: Cooperative sector missions
description: Durable scope and release boundary for WFM's expanding multiplayer flight sectors.
---

WFM's cooperative expedition is a separate server-authoritative mission chain:
Rust Disc → Mars Approach → Pale Beacons. It builds on the deterministic 3D
flight model and existing verified socket/database ownership rather than
replacing the Wing competitive or AI-fill systems.

**Why:** the owner asked for shared true-3D exploration and campaign-linked
discoveries while preserving the current player data and earned-credit rules.

**How to apply:** keep discoveries account-scoped, idempotent, and separate
from Wing match rewards and the original campaign's clear count. Current
discovery awards are zero credits. Production remains opt-in on both socket
and frontend; local tests and staging evidence are not Production approval.
