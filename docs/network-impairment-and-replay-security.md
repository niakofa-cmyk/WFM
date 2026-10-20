# Network Impairment and Replay Security Report

**Tested source commit:** `4e1cfcd98d782f0f454e6c82538c1f9e55982d95`  
**Test date:** 2026-10-20

## Repeatable local socket test

The API-server test suite now includes a seeded WebSocket proxy and a live-room scenario. Run it with:

```sh
pnpm --filter @workspace/api-server run test
```

The scenario uses seed `41027`, 35 ms base latency, ±20 ms jitter, and a 20% frame-loss rate. It exercises one pilot through the proxy while the room's other seats remain AI-controlled, then reconnects that pilot through the same impaired path and verifies the original seat and input sequence resume.

One recorded run reached input sequence 80 before reconnect and sequence 120 after reconnect. The proxy dropped 32 client-to-server input frames and 49 server-to-client snapshot frames; scheduled delays ranged from 15 to 55 ms.

**Scope limitation:** this intentionally drops WebSocket application messages (`input` and `snapshot`), not IP packets. WebSocket uses TCP, so this is not a substitute for testing real packet loss, congestion, or WAN routing. It is a deterministic application-level regression harness, not a real-network certification.

## Replay reward validation

The claim path now rejects replays longer than the mode's fixed simulation duration: 21,600 frames for a six-minute Strike and 7,200 frames for a two-minute practice run. It checks exact input fields and ranges, rejects repeated one-shot controls without a release frame, runs the fixed 60 Hz server simulation with its cooldown rules, and rejects incomplete or post-match frames. The API schema limit was updated to match the Strike maximum.

The server still loads the run configuration and player state itself, binds claims to the authenticated player and stored run, checks profile revision and expiry, and grants the stored result once. Client-supplied credits, rewards, unlocks, or campaign completion are not accepted.

This is **not complete anti-cheat protection**. The replay still contains client-submitted inputs. A modified client or bot can choose a strategically favorable sequence of otherwise legal inputs. The checks establish that a replay is structurally valid and resolves under the server simulation; they do not establish that a person played it or replace authoritative live multiplayer simulation.

## Development verification

- `pnpm -w run build` — passed, including API/socket and game builds.
- `pnpm -w run test` — passed: 30 API-server tests and 6 game-client tests.
- `git diff --check` — passed.
- Development API readiness returned `ready` with `database: true`; socket health returned `ok`.
- The browser check showed the public sign-in page only. Signed-in account flows were not verified.

## Production and release gates still open

No production deployment or production database migration was performed. Before treating the economy and progression as production-ready, verify in a controlled production-like environment:

- Production schema migrations and configuration.
- Authenticated access for separate real accounts; private inventories and progression with a shared market.
- Concurrent and retried trades, duplicate-request handling, and durable transaction recovery.
- Backup and restore, operational logging/monitoring, and deployment rollback.

Also still outstanding: ten real people across separate ships, real-network latency/jitter/IP-packet-loss and reconnect testing, sustained server-load and long-session testing, consistent combat/objective/result views across clients, physical Android Chrome and iOS Safari testing, and recovery from interrupted production sessions. The current alpha restart policy ends active rooms without rewards and requires players to create or join a fresh room; saved profiles and progression remain separate from those in-memory rooms.
