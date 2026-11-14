# Opening history, command entry and authoritative recovery

## Controlling direction

The historical opening, player entry and live war are different things.
Dusk's private expedition attempted to seize an already inhabited Mars.
The Accord destroyed his fleet and captured him; the capture transmission
reached Earth before the fleet's destruction. Earth’s response precedes the
Contact → Beacon → Warden → Cage campaign. Dusk is not a serving commander,
voluntary captive or willing Cage-route truth-teller.

The player enters a landscape command hangar, chooses/configures a saved
USSF or Accord hull and explicitly enters the existing Orbital universe.
Three.js remains the primary renderer beneath that universe. Cooperation,
patrol encounters and live combat stay in the same shared flight scene.
Historical context does not create a separate game or a new campaign unlock.

## Source archive and reconciliation

The four supplied documents are preserved verbatim under
[`references/opening-and-recovery/`](references/opening-and-recovery/):

- `OPENING-ENCOUNTER-SOURCE.txt`
- `OPERATIONAL-SIMPLIFICATION-SOURCE.txt`
- `PROLOGUE-BOOT-ASSESSMENT-SOURCE.txt`
- `PERSISTENT-STORY-TRACKING-SOURCE.txt`

Their completion/deployment claims and example bundle measurements are source
assertions, not evidence that this repository has those features.
Their mock authentication, localhost socket, invented ledger/schema,
automatic faction assignment, universal kill increments, equal-split bounty
bonus and replacement scene are not adopted. Keep actual authenticated
admission, deterministic movement, attribution, transactional ledger and lazy
renderer. Do not delete compatibility routes merely to reduce a bundle.

The [canon](MARS-STORY-CHRONOLOGY-AND-CANON.md),
[story foundation](WAR-FOR-MARS-STORYLINE-FOUNDATION.md),
[structural roadmap](STRUCTURAL-REBUILD-ROADMAP.md) and
[rendering strategy](RENDERING-STRATEGY-AND-UNIVERSE-OWNER.md) govern conflicts.
Exact expedition years, instant destruction and Witness origin are not invented
from sample UI prose. Preserve the later player-specific Cage branches.

## Implemented slice

**New opening encounter direction:** after explicit hangar launch, a fresh pilot
now requests a Lab-style live patrol battle inside this same universe. This is
not the historical prologue or a separate training mission. Read
[the opening encounter contract](LAB-STYLE-OPENING-ENCOUNTER.md) for insertion,
reservation, reconnect and unavailable-contact rules.

1. Account boot no longer mounts shared flight automatically. Runtime selection,
   chart/invite handling and compatibility rollback remain; the existing primary
   hangar button still fetches the verified world anchor before mounting Arena.
2. A collapsed **The Last Expedition** history panel is available in the hangar.
   It is public background, clearly separate from recovered evidence, with no
   reward, completion flag or account mutation. It never forces a defeat.
3. Authoritative disabled state displays immediate **Recover to Hangar** and
   **Return Without Recovery** controls. Only a server recovery acknowledgement
   exits through the recovery action. Ordinary return does not repair anything.
4. `freeflight_recover` is an authenticated, joined-seat operation with no client
   destination, ship, health, reward or identity fields. It requires a destroyed
   craft, unchanged verified location and no pending claim or unresolved battle.
   The server removes the disabled actor after authorization; it does not spawn
   an unattended replacement while the player is in command. The next explicit
   deployment uses normal server anchor admission and the saved loadout.
5. A living ally keeps the shared battle active. When every participant is
   destroyed, the server finalizes an aborted result with zero credits, preserving
   actual kills/assists and the existing transactional patrol/ledger contract.
   Recovery waits until that durable operation succeeds, including retries.
6. Death, damage and unresolved attribution survive disconnect grace expiry
   within the running socket process. A loadout change cannot reconstruct a
   damaged living craft; a destroyed rejoin retains its original craft, even
   when the saved loadout has changed, so recovery is still accessible.
7. The shared-flight menu explicitly states that the live simulation continues.
   It does not claim that pausing protects the pilot.

## Boundaries and remaining work

- This slice is not a rendered cinematic or interactive historical battle.
  No prologue SQL migration, first-login completion tracking or forced playback
  is introduced. Build a skippable, replayable historical presentation only
  after these entry/recovery foundations are verified.
- Recovery here is server-owned lifecycle control, not a paid installation
  repair/economy system. Its destination is the existing verified location
  anchor; do not imply arbitrary travel or docking.
- Retained damaged/disabled seats remain bounded by existing session/pilot caps.
  Their health is **not yet durably checkpointed across socket process restarts**.
  Persistent recovery records and safe eviction need a separate storage contract
  before claiming restart-proof recovery or fleet-scale capacity.
- Ledger settlement retains its rollout gate. Storage failure or a disabled
  settlement service fails recovery closed; do not discard a lease to unblock it.
- No staging or Production rollout, physical-device certification, completed
  two-pilot recovery journey or full training parity follows from source tests.

## Verification contract

Test ordinary account boot, explicit launch, rejected recovery for living ships
and extra fields, destruction by actual server weapon fire, rejoin/TTL without
healing, changed loadout without resurrection, pending settlement rejection,
location revalidation, one durable aborted result and subsequent explicit
redeployment. Verify actual kills remain attributed and defeat never awards
credits. Keep the unchanged 143,360-byte Combat Lab initial bundle gate.

Local checks passed: seven focused boot/history/combat-state tests, nineteen
runtime/settlement tests, frontend and backend type checks, both game builds
and four static build checks. Final Combat Lab initial JavaScript is 126,487
bytes gzip; main entry is 125,799 bytes gzip. Three.js is outside both initial
static graphs. API, socket and frontend workflows restarted successfully.
The unauthenticated preview renders the retained local Orbital entry; this is
not an authenticated hangar/recovery screenshot or staging certification.
