---
name: Online multiplayer scope
description: The user's stated scope boundary for the first online multiplayer milestone.
---

Use isolated invite-code rooms, each with ten seats split 5v5, the existing AI fill, and a five-second reconnect hold. Authenticated accounts, server-owned progression, a shared market, and persistent single-player universe state are in scope.

The persistent universe includes campaign locations, discoveries, faction reputation, side quests, and world events. Do not add matchmaking or a shared real-time galaxy unless asked. Continue to distinguish code simulation from real-phone testing.

For the multiplayer alpha, room state is intentionally process-local and active matches do not survive a socket-server restart. Graceful shutdown must interrupt active matches and tell players to create or join a new room; interrupted matches award no rewards. Normal temporary disconnects keep the existing five-second reconnect window. Server shutdown must not modify saved profiles, credits, inventory, or completed campaign rewards.

**Why:** the user chose an early-alpha policy that favors a clear, no-reward interruption over durable match restoration while preserving account progress.

**How to apply:** broadcast the interruption on graceful shutdown, reject stale reconnect tokens after restart, return players to the menu with a clear message, and leave progression tables untouched. Keep the five-second reconnect flow for ordinary disconnects.

**Why:** the user expanded the roadmap to require server-owned progression, a player-driven economy, and a persistent universe while keeping matchmaking out of scope.

**How to apply:** keep online rooms isolated, but persist economy and campaign-universe state in shared server tables. Do not add matchmaking or shared real-time galaxy simulation, and do not claim physical-device certification without testing phones.
