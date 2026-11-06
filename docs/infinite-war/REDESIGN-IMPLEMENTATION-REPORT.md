# Connected-universe entry redesign — implementation evidence

## Subsequent account-universe connection

The next three steps are described in
[Connected universe integration](CONNECTED-UNIVERSE-INTEGRATION.md): real account
position, real operation discovery and safe handoff to existing authorized
destination controls. These extend the original offline-entry slice below.

WFM typecheck and 274/274 game/auth tests pass; both builds and 4/4 static checks
pass. The additional seven guards cover server-only map data, location/selection
separation, travel affordability/lock/freshness, public operation filtering,
session expiry/privacy, docking-aware control targets and authenticated versus
offline entry separation. Actual signed-in account travel, persistence and
match admission have not yet been certified by these checks.

Browser evidence:

- Actual public-page handoff from the offline Lab to the account universe gate
  passed; the internal sign-in return path is `/universe`. Returning to offline
  training triggered no account-world/API request.
- An explicitly isolated component fixture verified inspect-only selection,
  10-credit confirmation/cancellation, exactly one travel callback after confirm,
  selection stability across polling, confirmed-location changes, directory
  failure messaging, operation-controls-only callbacks and stale-state disabling.
  The initial disabled current-site controls check used an inconsistent
  `canOpen:false` fixture; correcting the fixture resolved it without relaxing
  application gates.
- Phone 402×874 and desktop 1280×800 fixture checks found no horizontal overflow.
  This is not a physical Android or signed-in account test.
- Read-only development probes: API health 200; anonymous world GET 401; public
  directory GET 200 with one site, three catalog operations, zero instances and
  zero events at observation time. No empty directory was presented as a live
  match. These counts are observations, not hard-coded expectations.
- No user was created or signed in, and no real travel, queue, room, registration,
  reward, staging or Production action was submitted. The dedicated signed-in
  journey remains a verification gap.

## Scope

The first redesign slice changes the existing `/combat-lab.html` entry rather
than creating a new app, renderer or combat engine. The controlling brief is
[Redesign direction](REDESIGN-DIRECTION.md).

Both owner sources are archived byte-for-byte and all five supplied images are
saved as reference assets. They are not embedded as supposed WFM gameplay.

## Implemented

- Original orbital navigation presentation with five selectable destinations.
  Selection drives the same destination briefing and launch action.
- Mars Orbit launches the existing offline Orbital Arena with the original
  training setup and selected faction/hull; its result returns to the entry.
- Cinder Ring lazy-loads the existing local docking approach with the selected
  faction/hull. Docking or aborting returns to the same entry. Completion does
  not enter a room, grant a seat, record travel or issue progression.
- Three proposed destinations show planned/unavailable status with launch
  disabled. They do not fabricate players, schedules or cosmic events.
- A real account-hub link retains the existing authenticated services.
- Faction selection updates a local briefing for the existing opposing AI
  training side; approach and planned destinations explicitly avoid fabricated
  patrol, allegiance and persistent-world claims.
- The latest Infinite Open Universe directive is mapped to the actual partial
  A–J state in the direction brief; one canonical Orbital engine remains the
  target, not a claim that retained mode-owned scenes have already migrated.
- Keyboard arrow navigation, radio selection semantics, touch targets,
  portrait scrolling, landscape layout and reduced-motion rules.
- Arena, docking and Three.js stay deferred. No new external font resource is
  added by this entry document; browser font fallbacks remain available.

## Verification

### Additional master directives and canonical approach controls

The five new owner sources are preserved unchanged and reconciled in
[MASTER-DIRECTIVE-RECONCILIATION.md](MASTER-DIRECTIVE-RECONCILIATION.md). This
adds implementation to the existing artifact/branch, not a separate universe.

Implementation:

- `CinderRingDockingApproach.tsx` removes its separate steering/throttle/keyboard
  mapping and uses the same `Bus`, `readInput`, normalization and spatial flight
  rules as offline Orbital. Left controls signed thrust and coordinated turn;
  right controls aim/pitch and direct roll; left edge taps retain vector pulses.
- The signed slider and meter use the same canonical throttle axis. The meter
  appears on commanded or actual motion; it does not introduce a second engine.
- Existing `orbitalCameraPose` keeps the chase camera stable during direct
  rolls, with the same release blend as Arena. Shared physics/rates/energy rules
  are unchanged. Range uses the scene's metre-scale units, not a spurious km label.
- Reset, all-stop/braking, abort and local dock neutralize the input. Hidden-tab
  clock reset prevents accumulated frame catch-up. Weapons and match entry are
  intentionally not added to local transit.
- `CinderRingApproachInput.test.ts` adds five source/shared-flight regressions:
  shared adapter selection, actual forward/reverse translation, simultaneous
  turn/bank/pitch, immediate quaternion roll and neutralization.
- Existing raw directives, required engine assessments, new source review and
  owner-direction memory are linked rather than duplicating the architecture.

| Check | Result for this slice |
|---|---|
| WFM typecheck | Passed, including final camera and visibility wiring |
| Game/auth tests | 282/282 passed |
| Main app and standalone entry builds | Both passed |
| Build static-resource/lazy-renderer checks | 4/4 passed |
| Five source archive comparisons | Byte-for-byte identical to uploads; architecture resend also matches the previous saved copy |
| Browser approach at 803 × 360 | Actual local entry/launch/fallback/abort exercised; no sign-in attempted, DOCK disabled |
| Actual WebGL flight browser proof | **Blocked:** browser could not create a WebGL context; no synthetic renderer or flight evidence substituted |
| Focused landscape layout recheck | Both sticks measured 78 × 78 px; center controls unobstructed; viewport and document width both 803 px |
| Physical Android controls and performance | Not verified for this revision |
| Live multiplayer/observer/authorized admission | Not exercised or certified by this local input change |

The browser reported `FLIGHT LINK UNAVAILABLE` with an explicit renderer error;
Abort returned to Cinder Ring entry with the no-progress message. API writes were
not independently audited in that browser pass. The local code path adds no
API call, identity, progression, room or reward capability.

The fallback screenshot exposed landscape flex shrink compressing the sticks
into capsules. The landscape CSS now prevents stick shrinking and hides side
captions/keyboard hints at short heights. A focused recheck confirmed circular
78 × 78 px sticks, no center-button overlap and no horizontal overflow. Enabled
buttons measured approximately 75 × 45 px. They were not re-clicked or treated
as flight evidence.

Audit references before this change: local base `fe07c9b`, staging branch
`3663e144938ba931cccaa624004814ab0fd65ff1`, integration base
`a9db849bfbbf559249b6bdd4def68ed794b31ec1`.
Draft [PR 14](https://github.com/niakofa-cmyk/WFM/pull/14) targets the integration
branch. These are Git references, **not** a verified deployment-revision report.
No merge, deployment, database, auth, reward or multiplayer flag change was made.

The prior tactical-input safety revision also passed 277/277 WFM tests and
4/4 build checks. Its
[advanced-control review](ADVANCED-TACTICAL-CONTROLS-REVIEW.md) records the
remaining A–K requirements; the larger maneuver library and tactical-settings
programme are not complete.

### Original entry verification (historical revision)

| Check | Result |
|---|---|
| WFM TypeScript check | Passed |
| Game/auth test suite | 267/267 passed, including four new destination, local-boundary and faction-briefing guards |
| Main app and standalone entry builds | Passed |
| Static resource and lazy-renderer build checks | 4/4 passed |
| Desktop preview, 1440 × 900 | Entry rendered; no browser errors |
| Phone-layout preview, 402 × 874, full page | Scrollable entry rendered; mobile map-label placement adjusted |
| Reference archive | Complete source matched original bytes; five images preserved |
| Direction-file local links | Verified |
| Development frontend | Restarted successfully |

The tests check destination identity/status/coordinates and guard deferred
loading, planned-launch restrictions and faction-opponent messaging. Screenshots check the initial visible
layout, not interactive flight. Existing Arena launch props and approach
callbacks were checked in source; neither full flight journey was driven in a
browser during this slice. No actual Android hardware, authenticated multiplayer
or event-streaming certification is claimed.

## Not implemented by this slice

Persistent spatial travel, unlimited streaming, new station geometry, live
Orbital multiplayer, nearby battle proxies, authorized 3D spectator cameras,
deterministic cosmic-event scheduling and all-mode migration remain separate
engineering work. The chart is a local entry interface, not persistent universe
authority or a completed universe simulation.

No backend/auth/database/reward/feature-flag changes, staging promotion or
Production deployment were performed. The earlier engine regression report
remains evidence for its own revision; no backend rerun is inferred here.

## Rollback and continuation

The UI change can be reverted independently: restore the previous entry and
HTML metadata, then remove the new chart, destination data and styles.
Shared flight simulation, stored player data and online services are unchanged.

Continue by connecting existing account-backed discovery/location state to the
same presentation through its real contracts, then verify universe-to-operation
handoffs. Those navigation connections are now implemented as described above.
Continue with versioned operation adapters and actual observer authority before
showing live battles or countdowns. The local Cinder control change can be
rolled back independently by restoring its TSX/CSS and removing its focused
tests; source archives and architecture evidence can remain. Shared physics and
stored account data do not need a rollback.
