---
name: Online multiplayer scope
description: The user's stated scope boundary for the first online multiplayer milestone.
---

Keep isolated invite-code rooms as a separate no-reward mode, with ten seats split 5v5, AI fill, and the existing five-second reconnect hold. The user has now approved an opt-in competitive queue that starts only when ten distinct authenticated humans are available; it auto-starts a balanced 5v5 with no AI seats.

The persistent universe includes campaign locations, discoveries, faction reputation, side quests, and world events. The competitive queue is process-local, matching the current socket-room lifecycle; a multi-process shared queue/routing layer is not implemented. A separate open casual room is not implied by the competitive queue. Continue to distinguish code simulation from real-phone testing.

For the multiplayer alpha, room state is intentionally process-local and active matches do not survive a socket-server restart. Graceful shutdown must interrupt active matches and tell players to create or join a new room; interrupted matches award no rewards. Normal temporary disconnects keep the existing five-second reconnect window. Server shutdown must not modify saved profiles, credits, inventory, or completed campaign rewards.

**Why:** the user chose an early-alpha policy that favors a clear, no-reward interruption over durable match restoration while preserving account progress.

**How to apply:** broadcast the interruption on graceful shutdown, reject stale reconnect tokens after restart, return players to the menu with a clear message, and leave progression tables untouched. Keep the five-second reconnect flow for ordinary disconnects. Client retries should stop about 800 ms before the server hold expires and only start when a complete handshake can fit.

**Why:** browser detection and network handshakes consume time after the server begins its five-second reservation; retries scheduled at or after expiry cannot reclaim the seat.

**Why:** the user later explicitly approved server-authoritative matchmaking with ten humans required to start, while keeping private rooms and AI-filled offline play distinct.

**How to apply:** keep private invite rooms isolated and no-reward. Only the authenticated, opt-in ten-human queue may create competitive matches; use exact opt-in feature flags and leave reward enablement separately gated. Do not add a global single-room free-for-all, GPS matchmaking, or shared real-time galaxy simulation without a separate decision.

For multiplayer reliability evidence, compare client views at the same authoritative server tick; delayed clients naturally receive different snapshots at a given wall-clock instant. Seeded local impairment proxies can validate latency, jitter, frame loss, and reconnect logic, but they are not evidence of WAN/carrier reliability or a full human match.

**Why:** the ten-client impairment run showed that equality checks across each client's latest snapshot are timing-sensitive, while equality at a shared server tick directly tests authoritative state convergence.

**How to apply:** record deterministic per-link impairment settings and metrics, check that all clients receive an identical snapshot for one server tick, and keep real-network, long-duration, and physical-device certification as separate gates.
