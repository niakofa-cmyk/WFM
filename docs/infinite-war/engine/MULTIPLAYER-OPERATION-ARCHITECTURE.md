# Multiplayer operation architecture

```text
Universe destination and public signals
     → authenticated entry / server-owned travel checks
     → operation registration or existing Wing matchmaking
     → versioned authoritative instance
     → sanitized spectator/universe event adapter
     → validated result / existing progression and reward transaction
     → same persistent world
```

## Preserve

Existing Clerk identity, authenticated seats, reconnect ownership, socket
rate/backpressure limits, room lifecycle, idempotent claims and reward ledgers.
Ten distinct authenticated humans remain required for reward-eligible 5v5.
Private rooms and AI-fill stay no-reward and absent from public discovery.
Spectators are read-only, do not consume player seats and receive no hidden
competitive/account/credential data.

## Current implementation versus target

The operation directory, Cinder destination, authoritative Wing service and
sector services exist. They are not yet one certified Orbital multiplayer
simulation. Local docking cannot authorize a seat. An Orbital authority unit
test or two-device private surface match does not certify ten-human Orbital.

## Version risk found during audit

`sector-contract.ts` advertises an opt-in `orbital-v2`/rules-2 contract.
`socket/sector-runtime.ts` default dispatch passes the current
`ORBITAL_RUNTIME_ID` (`orbital-v5`) into the sector adapter. That adapter currently
uses a common movement implementation for Orbital IDs rather than selecting
every combat ruleset by that declaration.

Do not silently rename the handshake or promote a new protocol. Establish one
explicit, immutable per-room executed simulation contract, retain old room
behavior, and test handshake → dispatch → snapshot → reconnect consistency.
This mismatch is recorded, not claimed resolved by the pilot-input extraction.

## First real Orbital asteroid gate

Require coordinated client/API/socket revision; authenticated participants;
server movement/weapons/damage/ammo; sanitized observer state; location and
capacity checks; disconnect/reconnect; terminal lifecycle and exactly-once
eligible settlement. Demonstrate multiple independent operations without shared
state contamination. Synthetic participants remain automated evidence only.
