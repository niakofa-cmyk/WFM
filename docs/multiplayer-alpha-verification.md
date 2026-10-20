# Multiplayer alpha policy and verification

**Source commit tested:** `f21884fa566e66e9c34e62a363c2769f5d8f8f64`  
**Date:** 2026-10-20  
**Environment:** Replit development workspace; local WebSocket clients

## Product decision

Multiplayer rooms are intentionally ephemeral for alpha. Room state exists only in the socket-server process. A socket-server restart ends unfinished matches; the server does not restore a match from a snapshot. Players must create or join a room again.

### Graceful restart

- On `SIGTERM` or `SIGINT`, the socket server broadcasts an `interrupted` packet with reason `server_restart` to connected pilots in unfinished active matches, then closes those sockets with code `4002`.
- The client exits the match, removes the stale reconnect token, returns to the main menu, and tells the player that the match ended because the server restarted. It says that no match rewards were issued and that a new room is required.

### Unexpected process loss

A process crash cannot send a final packet. When a client reconnects to the replacement process with its old token, the missing room is rejected as `session_lost`. The client reports that the previous match could not be restored after a restart or room expiry, awards nothing, and requires a new room.

### Ordinary disconnect and cleanup

- A temporary socket disconnect reserves the pilot’s seat for five seconds. Reconnecting during that window restores the same seat and token.
- After the reservation expires, AI takes over the empty seat. New humans cannot join an already-active match.
- An empty room is removed after ten seconds. An inactive lobby expires after fifteen minutes.

## Progression and reward safety

Online matches do not submit a single-player replay claim or grant campaign rewards. The online completion path sets no credits or progression, and an interruption exits before the match completion handler. The socket server has no writes to player profiles, credits, inventory, or completed mission rewards. Existing server-owned single-player progression and idempotent reward claims are unchanged.

The in-memory room token is invalid after restart, so it cannot restore or replay the interrupted room. A new room is a new match, not a resubmission of the previous match’s reward claim.

## Verification

| Check | Result |
| --- | --- |
| `pnpm -w run build` | Passed, including workspace typecheck and API/socket/game builds |
| `pnpm -w run test` | Passed: 27 API-server tests and 6 game tests |
| `git diff --check` | Passed |
| API readiness | `GET /api/readyz` returned `200`, database ready |
| Socket health | `GET /healthz` returned `200`, zero rooms after restart |
| Two-pilot socket test | Passed: distinct seats and teams, separate inputs moved their assigned ships, and both clients received identical authoritative snapshots |
| Restart test | Passed: active match receives the interruption packet and close code; old token is rejected by a fresh server; a new room can be created |
| Ordinary reconnect regression | Passed: a pilot reclaimed the same active-match seat within the five-second reservation |
| Ten-client regression | Passed: ten clients can ready, launch, and receive the six-minute match result in the automated local test |

## Not certified by these checks

- No ten-person playtest or independent human-player session was run.
- No real-network latency, jitter, packet-loss, or reconnect-under-impairment test was run.
- No long-duration or sustained server-load test was run.
- The two-pilot test proves independent server-side seat control and identical server snapshots; it does not certify that targeting, damage, objectives, and final results remain visually and behaviorally consistent in real browsers across a full match.
- The automated clients run locally. They are not evidence of deployed-service or physical-phone performance.

The next multiplayer certification step is a real two- or ten-player session with network impairment and a shared evidence log. Do not report those results as passed until that test is performed.
