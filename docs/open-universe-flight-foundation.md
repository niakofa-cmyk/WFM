# WFM open-universe flight foundation

## Source and scope

The owner's full supplied document is retained unchanged at
[open-universe flight vision](references/wfm-open-universe-flight-vision.md).
It is a direction and staged roadmap, not evidence that its features exist.
Its repository observations were checked against local sources: the current
competitive/replay simulation uses X–Z movement despite Three.js presentation.
Some source links are unrelated to WFM; they are not adopted as canon or
verification evidence.

The owner explicitly corrected the faction palette: **USSF is blue; Accord is
warm amber/solar**. Keep faction identity separate from friendly/hostile cues.

## First playable implementation

`/flight` is a lazy-loaded **local, no-reward Rust Disc flight trainer**,
reachable from public arrival and the signed-in command menu. It does not
require sign-in, change a saved hull, issue a replay claim, create campaign
discoveries, or connect to multiplayer. Selecting a training hull is separate
from the Armory's saved account preference.

The pure flight kernel uses:

- Genuine XYZ position/velocity and normalized local-space quaternions.
- Hull-derived acceleration, maximum speed and turning; momentum, braking and
  finite boost energy.
- A versioned bounded sector with 3D spherical obstacles and swept collisions.
- Proximity-based relay discovery, a combat training drone and extraction.
- Forward projectiles, line-of-sight/range/cone gated missile locks, guided
  missiles with limited ammunition/cooldown, and defensive countermeasures.
- A terminal completion/destruction state, not local credit settlement.

The renderer consumes those same obstacle coordinates. Decorative planets and
stars are not collision objects. Frame rendering and simulation are separate;
the UI owns the fixed-tick accumulator and safe pause/reset on interruption.
Graphics quality is a presentation choice, never a change to collision geometry.

## Boundaries that remain deliberate

This is not an online server-authoritative flight sector, seamless galaxy,
reward-eligible match, fully realized cockpit, new native engine, or Production
release. The existing authenticated API, database, multiplayer protocol,
competitive queue/reward policy and deterministic replay modules remain intact.
No auth/provider replacement, migration, Railway configuration change or
Production deployment is needed to try the local trainer.

The local kernel currently uses native trigonometry. Do not import it into
reward adjudication or competitive rooms: that promotion requires deterministic
math, versioned snapshots/inputs, server input/weapon validation, state-convergence
and cross-runtime replay tests. Existing Node/Chromium deterministic guarantees
for `sim.ts` cannot be claimed for this separate trainer.

## Shared 3D universe runtime requirement

The live movement/presence and privacy contract is now specified in [`infinite-war/LIVE-3D-FREE-FLIGHT-PRESENCE-AND-PATROLS.md`](infinite-war/LIVE-3D-FREE-FLIGHT-PRESENCE-AND-PATROLS.md), with patrol lifecycle requirements in [`infinite-war/PERSISTENT-ENEMY-FLEET-PATROLS.md`](infinite-war/PERSISTENT-ENEMY-FLEET-PATROLS.md). The first server movement/snapshot implementation is opt-in; the local `/flight` trainer remains separate and is not evidence of shared multiplayer flight.

## Next engineering gates

1. Validate flight comfort, spatial navigation, thermals and memory on the
   supported Android hardware. Record local/software graphics separately from
   installed-APK and physical-device evidence.
2. Design a versioned authoritative 3D session contract using existing rooms,
   not a second networking protocol. Preserve private/AI-fill no-reward rules.
3. Verify collision, targeting, prediction, interpolation and reconnection under
   delayed/invalid input; measure bandwidth and server tick cost.
4. Connect discoveries and mission results to existing authenticated campaign
   services only after server validation and idempotent settlement exist.
5. Expand sectors only after a complete Rust Disc journey works reliably.

The full source contains a longer roadmap. Do not mark the entire vision
implemented merely because this playable foundation exists.

## Local verification — 2026-11-01

- Full frontend suite: **89 passed, 0 failed, 0 skipped**, including 15 new
  flight/faction tests. Existing browser/server simulation-source parity tests
  remain passing; those modules were not changed.
- Full workspace typecheck passed. Frontend typecheck also passed after the
  final control/camera corrections.
- Frontend production build passed in **4.54 seconds**. The existing Three.js
  shared chunk still emits Vite's >500 kB advisory; the trainer is lazy-loaded.
- Automated local Chromium/SwiftShader smoke check passed all eight hulls,
  corrected palette, WebGL launch, steering/fire, camera switching, neutral
  touch origin, release-to-center, pause/restart, portrait recovery, briefing
  touch-scroll configuration and renderer teardown. **0 page exceptions,
  0 trainer writes and 0 trainer API calls.** Returning to the normal landing
  page can initialize that page's existing Clerk SDK; that is not trainer traffic.
- The first harness run needed to leave fullscreen before resizing its browser
  viewport. A later harness assertion incorrectly included the landing page's
  Clerk initialization after exit; request collection is now scoped to flight.
  These were harness issues, not successful sign-in or Production checks.
- Mobile briefing screenshot and active software-rendered scene inspected.
  No physical-device performance, network multiplayer or Production certification
  is inferred from this evidence.

Changes remain local. No remote push, Railway configuration change, database
operation, release or deployment was performed.
