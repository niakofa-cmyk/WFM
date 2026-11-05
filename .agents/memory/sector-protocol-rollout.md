---
name: Sector protocol rollout
description: Safe client/API/socket rollout for the Orbital co-op sector contract.
---

Keep the Orbital sector protocol opt-in on both the frontend and socket. V1 remains the rollback-compatible default. Enable V2 only when the frontend, API, and socket are on the same staging revision and multi-pilot checks pass; do not enable it in Production as part of a code change.

**Why:** the co-op simulation is server-authoritative and client, API, and socket deployments can drift independently. A strict runtime/rules handshake prevents a client from silently joining a mismatched simulation.

**How to apply:** compare deployed revisions first, then set the client and socket V2 flags together in isolated staging. Verify authenticated joins, synchronized flight state, mission lifecycle, and settlement boundaries before promotion. A version mismatch should fail closed; rollback by restoring the compatible V1 deployment and configuration.
