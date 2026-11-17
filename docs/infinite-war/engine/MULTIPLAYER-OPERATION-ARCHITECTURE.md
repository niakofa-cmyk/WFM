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

The target also includes authenticated, server-authoritative exploration with
faction encounters, validated enemy-hull tallies, and eligible PvE/exploration
rewards. This is separate from offline no-reward practice and from private or
AI-fill Wing rooms. It needs a dedicated encounter/result contract; it must not
be implemented as a client-side award path. See
[`../DYNAMIC-FACTION-ENCOUNTERS-AND-EXPLORATION-AUTHORITY.md`](../DYNAMIC-FACTION-ENCOUNTERS-AND-EXPLORATION-AUTHORITY.md).

## Room simulation contract

Protocol 2 advertises `orbital-v2`/rules 2 and now dispatches that same pinned
runtime. Compatibility protocol 1 stays on the preexisting server runtime;
protocol 1 does not advertise a simulation contract. A shared resolver maps
wire protocol to runtime. Unit tests assert both choices. This code-level fix
does not switch the protocol rollout flag or prove a multi-device staging room.

Continue to keep one explicit, immutable per-room executed contract. Test
handshake → dispatch → snapshot → reconnect consistency before enabling a new
protocol in staging.

## First real Orbital asteroid gate

Require coordinated client/API/socket revision; authenticated participants;
server movement/weapons/damage/ammo; sanitized observer state; location and
capacity checks; disconnect/reconnect; terminal lifecycle and exactly-once
eligible settlement. Demonstrate multiple independent operations without shared
state contamination. Synthetic participants remain automated evidence only.
