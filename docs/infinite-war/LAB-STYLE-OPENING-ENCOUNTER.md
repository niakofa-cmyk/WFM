# Combat Lab-style opening inside the live universe

## Owner direction

The hangar's explicit Enter Universe action should begin with the readable,
visible fleet battle experienced in Combat Lab training. After that encounter,
the pilot continues exploring the same extended Orbital universe. The training
game is a source of working flight, aiming and battle behavior, not a second
destination to launch and return from. Three.js remains the primary renderer.

This is a present-day patrol encounter, **not** Dusk's historical expedition
replayed as the player, a forced defeat, a campaign completion, or a substitute
for the Last Expedition background. USSF pilots face Accord ships and vice versa.
Hangar-first explicit launch and authoritative disabled recovery remain intact.

## Review of the actual training and shared-flight systems

| Responsibility | Training Lab | Live universe / opening |
| --- | --- | --- |
| Initial opponents | Local `createMatch`, bounded AI roster | Existing persistent patrol roster from authenticated world admission |
| Flight and aiming | Orbital spatial integration and inverse-rotation steering | Existing server spatial integration; server-selected opening heading faces the hostile formation |
| Primary weapons | Local projectile volleys and impacts | Existing authoritative volleys, swept impacts, shields and hull damage |
| Enemy awareness | Local nearest-target and formation logic | Existing sensors, last-seen search, pursuit, encounter participation and same-faction assistance |
| Firing discipline | Aim before shooting | Patrol primary fire now requires a three-dimensional aim cone, not distance alone |
| Defeat and results | Local training summary, no account rewards | Existing defeat/recovery safeguards and durable encounter ledger |
| After battle | Local training ends | Same socket, scene and universe remain; no victory-to-menu transition is added |

Do not claim complete parity. Training's role formations, ship specials,
AI missile behavior, countermeasures and environment collision behavior need
individual shared-server parity work and verification. They cannot be copied
as client-authoritative damage or reward code.

## Implemented opening contract

The main hangar-to-universe Arena requests an opening encounter through an
additive `openingEncounter: true` join intent. Legacy joins remain valid.
There is no client-selected patrol, enemy faction, pose, health, damage,
player identity, result or reward field.

For a **new** admitted server actor only, the server chooses the nearest living
hostile persistent patrol within 700 metres of the normal local insertion
anchor. It places the new craft approximately 145–147 metres from the contact,
within the unchanged 180-metre engagement trigger, and points it at the contact.
This is bounded initial insertion in the already verified location shard,
not persistent world travel, docking, an in-flight teleport or unlimited spawn
selection. Other pilots, patrol positions and rosters are not moved or reset.

The server then runs the **same** encounter reservation, roster validation,
participants, weapon permissions, attribution and settlement used by later
free-flight fleet encounters. No local training enemies become rewardable.
Reservation failure never creates combat authority. The existing error channel
reports the failure and the shared scene remains available.

A retained actor returns `resumed`: its position, health, life, battle and tally
are preserved, including a disabled craft. An opening request cannot heal it,
reset a lease, mint ships or repeatedly award a bounty. Explicit server-approved
recovery remains necessary after defeat. A fresh insertion after recovery uses
the surviving strategic roster, never a replenished training roster.

If combat services or a valid nearby persistent contact are unavailable, the
client displays **No opening patrol available — continue free flight** rather
than inventing a fight. Guest/offline training remains separate and no-reward.

## Continuity and verification boundary

Opening insertion does not introduce a room, another scene, a timer, extraction
gate or a match-end redirect. Existing later proximity triggers can bring other
fleets into the battle; nearby allied pilots use normal live assistance.
Server-confirmed kills/assists and rewards use the existing contract and
idempotent ledger; aborted encounters retain valid attribution but award no
credits. Dead pilots use the existing recovery UI.

Local automated coverage checks both faction directions, facing and engagement
range, actual opening player weapon emissions, reconnect identity/position,
single reservation, rejected client pose fields, unavailable patrols and
failed reservations. Existing runtime/settlement tests cover damage, defeat,
assistance, recovery and settlement. This does not certify fresh authenticated
two-pilot play, physical-phone combat, all Lab features, or Production readiness.

Staging must deploy matching client/socket code before this new join intent is
enabled there. No staging or Production deployment is implied by this source
implementation.

### Local verification

- 23 server opening/runtime/settlement tests passed, including real emitted
  opening player shots for both factions.
- Eight client opening, boot and battle-state tests passed.
- Frontend and API TypeScript checks passed.
- Main and standalone Combat Lab production builds and four static-build
  checks passed. Combat Lab initial JavaScript was 126,487 bytes gzip against
  the unchanged 143,360-byte limit; Three.js remained outside that graph.
- Frontend, API and socket workflows restarted cleanly. The public entry
  screenshot rendered; it was an unauthenticated offline entry, not evidence
  of signed-in live combat or physical-device graphics.
- The exact source was subsequently deployed successfully to all three
  separate staging services. Protected unauthenticated gateway probes returned
  401 and the Combat Lab bundle audit remained below budget. Automated
  authenticated staging was attempted, but both sign-in flows remained at
  client-trust challenges; no authenticated profile was established. Thus the
  staging opening encounter, hits, kills, rewards and post-battle flight remain
  unverified.
