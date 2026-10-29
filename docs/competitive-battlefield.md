# WFM — Aerial battlefield rotation

## Product direction

Connect the existing 5v5 flight loop to the wider Mars theater through distinct,
readable combat spaces. A field should change the tactical picture—relay spacing,
cover, lighting, and approach lanes—not merely rename a room. The UI should
brief pilots before launch and keep the same field identity visible in flight.

## Implemented in the current staging source

- Each newly created 5v5 room receives one of the existing deterministic
  simulation fields: Rust Basin, Beacon Spur, Terminator Ridge, or Dustline
  Crossing. Selection is derived from the server-created room seed.
- The socket sends the selected field and its actual relay/rock layout in the
  lobby packet. The client renders a schematic map and short tactical briefing
  from that server-provided state.
- The live Wing status line identifies the same field. Arena terrain, lighting,
  relay positions, and obstacles continue to come from the existing match
  snapshot.
- Reconnecting players and all room members see the same server-owned field.
  No client-selected map can change the current match layout.

This is **field rotation inside isolated room-code matches**, not a public queue,
ranked ladder, geospatial matchmaking service, persistent map ownership system,
or shared live galaxy. Room-code matches remain private and no-reward.

## Review of the supplied implementation proposals

The five supplied documents are retained in `attached_assets/` as source
references. Their goals were evaluated against WFM's actual socket, simulation,
auth, and progression systems; the code examples are not drop-in components.

Safe product goals reused:

- Give pilots a clear pre-launch view of the battlefield.
- Make arena layouts tactically distinct and consistent for every pilot.
- Keep replay/settlement protections server-owned and covered by tests.
- Observe performance without exposing player identity or location.

Rejected implementation assumptions:

- The proposed `competitive_rooms`, `player_inventory`, and `ProductionDatabaseDriver`
  do not match WFM's existing Drizzle schema or current in-memory room lifecycle.
- The proposed HTTP middleware trusts `x-verified-player-id`; only the existing
  cryptographically verified request/socket identity is authoritative.
- Client-submitted loot, telemetry seeds, or winners cannot be used for rewards.
  Existing Wing settlement derives outcomes on the server and uses the existing
  idempotent progression ledger.
- Real GPS coordinates are unnecessary for a fictional in-game map and would
  introduce sensitive location collection. Synthetic coordinates and random
  coordinate offsets are not valid matchmaking evidence.
- The proposed cache evictor deletes from a schema WFM does not have, and the
  cleanup-worker example uses statuses not present in the current Strike schema.
  Neither should be installed as a scheduled production worker.
- Webhook examples expose regional labels and unreviewed runtime details.
  Operational alerts need an approved privacy-safe event contract and secret
  handling before adoption.
- Sample tests use mocked identities and settlement behavior that do not prove
  the repository's real auth, database transaction, or socket contract.

## Verification and release boundaries

Regression coverage verifies deterministic server field rotation, battlefield
briefing metadata and map bounds, plus that the socket lobby's map matches its
authoritative match snapshot.

These are code-level checks only. They do not certify map balance, deployed
staging behavior, a real competitive matchmaking queue, reward-ledger state,
or Production readiness. Production configuration and deployment were not
changed. Keep the separate reward, physical-device, Clerk, and staging
promotion gates intact.

## Next design stages

1. Collect map-by-map 5v5 playtest evidence before adjusting layouts or balance.
2. If a public competitive queue is approved, design its server-owned room
   issuance, capacity/rate limits, reconnect semantics, and privacy-safe region
   handling separately from private room codes.
3. Keep map result/reward settlement tied to verified server match state; never
   infer eligibility from map choice, room-code shape, or client telemetry.
