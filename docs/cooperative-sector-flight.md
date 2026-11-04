# WFM Cooperative Sector Flight

## Source and scope

The full owner-supplied architecture reference is retained byte-for-byte at
`docs/references/wfm-multiplayer-progression-vision.md`. It argues for
authoritative multiplayer, real progression, and mission-linked exploration.
Its claim that the existing game has no online reward flow is stale: the
separate Wing server-owned reward path already exists. This expedition uses
that architecture without changing Wing reward policy.

## Implemented slice

- `/flight` remains the local, offline, no-account trainer.
- `/expedition` is authenticated through the existing Clerk session and shared
  Railway WebSocket origin/verifier. The socket accepts only allowlisted
  mission/room query parameters, authenticates before `sector_join`, and binds
  the account identity from the verified session. No ID header, query token,
  client result, position, credit amount, or reward claim is trusted.
- Each mission runs the existing deterministic 3D flight physics on the
  server. The server sends authoritative pilot snapshots; clients render those
  snapshots and send bounded control inputs only.
- The eight existing hulls can fly together in one cooperative party. A single
  server-owned drone/objective is shared by the room; missions have a
  15-minute cap, rooms have a 32-room cap, and input is stale-neutralized.
- The physical Mars sphere is placed outside the Rust Disc debris field, inside
  the same bounded 3D flight volume. Mars Approach is an orbital survey: no
  surface landing is implied. Pale Beacons extends exploration past that orbit.
- The separate chain is Rust Disc → Mars Approach → Pale Beacons. Its
  `flight:` discovery IDs and `world_exploration` ledger records do not mark
  the original campaign sorties as cleared.
- The first verified discovery is an account-bound, idempotent unlock and
  awards **zero credits**. It does not add a currency or change the account
  balance. An atomic transaction records both the discovery and its
  zero-delta ledger event. Persistence failure is reported instead of claiming
  success; retry uses the same frozen server proof/idempotency key.
- The feature defaults on in development and off in Production. Production
  requires explicit server `WFM_SECTOR_FLIGHT_ENABLED=true` and a production
  frontend build with `VITE_WFM_SECTOR_EXPEDITION_ENABLED=true`. Turning off
  either side prevents entry. This local implementation has not enabled or
  deployed either Production setting.

## Verification and release boundary

Focused local tests exercise the actual authenticated WebSocket service with
synthetic test sessions, two-client snapshot synchronization, movement, auth
rejection, origin and URL-token rejection, restart interruption, deterministic
physics/catalog parity, feature fail-closed rules, identity isolation,
mission prerequisites, and synthetic-UUID database persistence/idempotency.
These tests do not certify a live staging deployment, real Clerk/Railway
configuration, ten-human competitive queue, mobile hardware, load capacity, or
Production readiness. Production signoff still requires a deliberate isolated
staging flag, paired authenticated-phone flight, ledger inspection, and the
existing deployment/auth gates.

## Operator constraints

Do not put account IDs, emails, session tokens or keys in room codes, URLs,
snapshots or logs. Keep room codes private to invited pilots and rotate them
after each flight. Retain the verified server authentication and CORS gates.
No database schema migration is needed; use the existing versioned schema and
tables. Do not bypass Clerk or issue client-generated completion claims.
