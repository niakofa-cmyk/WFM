---
name: Pilot experience
description: The WFM flight HUD and touch-control direction.
---

## Current right-thumb direction

The [dynamic right-thumb foundation](../../docs/infinite-war/RIGHT-THUMB-DYNAMIC-FLIGHT.md)
overrides earlier aim-only guidance below: default to Hybrid attitude plus
physical lateral/vertical translation, with normalized diagonals, deliberate
eight-way directional bursts and an Aim-only rollback profile. Keep left-thumb
propulsion and the sticks' existing landscape placement.

**Why:** the user explicitly requested that right-thumb motion move the hull
sideways/up/down as well as aim, with faster directional dodges from two matching
taps or flicks to improve combat evasion.

**How to apply:** use the existing shared axes and energy physics. Shared bursts
and circular roll require advertised server capabilities and server-owned
validation; device-local profile preferences must not replace account
progression. The shared Orbital circular roll uses
`orbital-barrel-roll-control-v1`; preserve Wing/sector contracts and historical
replays. Do not treat source tests as staging or physical-device evidence.

**Verification rule:** hold hull and encounter conditions constant before
claiming a maneuver improves survival. Changing loadouts or fighting a depleted
fleet can prove functional combat and settlement, but not an evasion advantage.
Two authenticated pilots also do not establish a shared assist.

**Why:** control acceptance, a surviving flight under different combat conditions,
and actual same-battle cooperation are separate kinds of evidence.

**How to apply:** report the loadout and encounter conditions with results; keep
server-controlled burst proof, same-flight settlement and nearby-assist proof
separate.

Treat [the pilot-experience reconstruction](../../docs/infinite-war/PILOT-EXPERIENCE-RECONSTRUCTION.md), [left-thumb control directive](../../docs/infinite-war/LEFT-THUMB-FLIGHT-CONTROL-DIRECTIVE.md), and [Orbital tactical maneuver roadmap](../../docs/infinite-war/ORBITAL-TACTICAL-MANEUVER-ROADMAP.md) as leading references for active flight screens and touch behavior.
Use [the image-reference review](../../docs/infinite-war/PILOT-IMAGE-REFERENCE-REVIEW.md) for visual composition; treat supplied images as inspiration, not artwork or interface to copy.
The full user-supplied tactical control documents and barrel-roll reference image are retained in `docs/infinite-war/references/`.
The re-supplied advanced directive is integrated with the universe redesign in
`docs/infinite-war/ADVANCED-TACTICAL-CONTROLS-REVIEW.md`; its full-circle proposal
must not silently revert the owner's later direct, responsive arc-roll controls.

**Rule:** Keep the ship, flight space, and combat readable. In offline Orbital, left-stick up/down drives forward/reverse throttle and left/right turns with coordinated bank; the right stick retains pitch/aim. Keep both sticks in their established positions and sizes. Keep only target lock beside the left flight stick; place the maneuver drawer and other flight-action tabs on the right with the combat controls. Keep operation copy off the active Orbital sightline: show the locked target’s faction, name, range, shield, hull, and lock progress beside the pilot’s own status, use faction color for healthy shields, and shift damaged hull cues toward red. Keep the reticle clear and leave operation details in the tactical map. A deliberate right-stick circular arc around the visible stick center arms after 60 degrees and drives signed roll immediately at a rate tied to thumb movement. Screen-space clockwise motion maps to visible right roll and counterclockwise to visible left roll; account for the y-down pointer coordinate system versus the ship-local roll axis. Reversing the arc reverses roll; release or pointer cancellation stops it without queuing a later animation. Right-stick aim and left-stick thrust/turn remain active while rolling. Use bounded quaternion rotation, charge 18 energy per full turn, and add a bounded lateral evade vector. Scale gesture radius bounds to the stick, process coalesced samples, and start the ten-second deadline at the first valid circular sample—not touch-down. During roll, stabilize the follow camera so it does not counter-rotate and hide the hull's rotation; blend back smoothly afterward. Same-sector edge double-taps remain short vector-thrust pulses (up/down vertical, left/right lateral), and the up-arrow action is vertical thrust. Keep missiles and primary fire by right-stick aim. Do not show a duplicate forward button by default. Preserve Rust Disc, server-authoritative co-op, and live Wing mappings; do not send local roll control through their existing adapters.

During the primary hangar-to-universe button gesture, request browser fullscreen with hidden navigation UI and landscape orientation where supported. Exit fullscreen when returning to the hangar. Browser APIs may deny fullscreen or orientation lock; keep the game usable and do not claim browser chrome can be hidden without a user gesture.

**Live roll cue:** Once a circular roll gesture arms, use the right thumb for roll only until release; do not let that same loop keep steering pitch/yaw. Show direction and LIVE state, not a full-circle progress ring that could imply the hull completed a 360° rotation. Compact short landscape controls only when viewport height requires it, and keep cockpit framing unchanged when increasing chase distance.

**Why:** A thumb-path progress ring measured gesture travel rather than ship rotation, while simultaneous steering could obscure whether the hull was actually rolling left or right. Short phone landscape viewports also clipped the control groups.

**How to apply:** Test both signed directions through the shared simulation, verify neutral input on release, and separately inspect the responsive flight HUD. Never report physical-device success from a simulator screenshot.

**Why:** The user clarified on 2026-11-05 that the Orbital left stick must be the primary propulsion control: up/down drives forward/reverse, horizontal drag turns while thrusting, and the up-arrow action is vertical rather than forward thrust. They later specified that stick positions and sizes stay unchanged, only target lock remains as an action beside the left stick, and maneuver/flight-action tabs belong on the right. They also asked to remove operation text from the active flight view and move target health beside pilot status, with faction colors that turn red as hull integrity falls. They reported the barrel roll only began after the loop and did not visibly complete; the desired behavior is direct hull control while the thumb is moving, including reversal and immediate stop on release. The earlier camera follow could also hide the hull's full rotation. The recognizer's radius bounds and deadline must match the visible stick and actual circular tracing. Rust Disc's source currently uses left-stick yaw/pitch with a separate throttle action, so do not claim its behavior is identical. The landscape reference still defines the HUD grouping, and live Wing's validated mapping must remain intact. Headless Chromium's live Combat Lab test can spend most of its budget starting the rendered scene, so use deterministic tests for full gesture/physics coverage and reserve browser tests for the interactive HUD with generous timeouts.

**How to apply:** Extend the existing `PilotFlightStick → input → Orbital simulation` path, not a second loop. Keep left-stick Y on signed throttle, X on yaw/coordinated bank, and right-stick aim/pitch active while the continuous roll arc is recognized. Keep the recognizer pure and test early arming, direction, reversal after arming, stick-relative radius, delayed touch-down, gesture duration, cancellation, and release neutralization. In shared Orbital, send roll only when the server advertises `orbital-barrel-roll-control-v1`; the server owns simulation, energy use and evasive thrust. Sector and Wing adapters must not forward it. Keep the sticks' size and side unchanged; keep target lock beside the left flight stick; place the maneuver drawer and other flight-action tabs on the right near missiles and primary fire. For Orbital HUD updates, remove mission copy from the center, put locked-target integrity beside pilot status, color it by faction with a red low-hull warning, and move mission details to the tactical map. Stabilize camera follow vectors during roll and fade back after release. Maintain neutral touch origin, cancellation reset, deterministic six-axis physics, and energy bounds. Do not treat browser emulation as physical-device certification; follow [the live Wing migration gates](../../docs/infinite-war/LIVE-WING-FLIGHT-CONTROL-MIGRATION-PLAN.md).

**Throttle and boost:** In offline Orbital, the left-stick throttle readout must share the simulation's signed input calculation, show forward/reverse/coast, and stay hidden while the hull is stationary. Keep temporary forward boost as a distinct hold action on the right; it accelerates forward only while active, consumes shared simulation energy, and shows remaining charge. Do not change Rust Disc's separate throttle behavior or live Wing authority as a side effect.

**Why:** On 2026-11-05 the user asked for the Orbital left-stick throttle and Rust Disc-style up/down feedback to remain visibly synchronized, plus a separate temporary energy-limited forward acceleration. The HUD should not imply throttle while the ship is still.

**How to apply:** Reuse the canonical input-to-throttle mapping for both simulation and display; test signed stick input, coast, keyboard compatibility, boost drain, and recharge on release. Keep the meter read-only and offline-only, and leave server-authoritative controls unchanged.

**Threat cues and actions:** Do not place a centered “PAINTED” text label over the sightline; preserve targeting and non-text warning cues. Keep forward boost stacked directly above primary fire. Surface the countermeasure flare in the right combat controls only while a hostile missile is incoming, rather than hiding it in the maneuver drawer.

**Why:** On 2026-11-05 the user asked to clear the centered pilot view, move boost above fire, and make missile escape/defense actions reachable without cluttering the HUD.

**How to apply:** Remove only the text overlay, not target-lock/painted state or its audio warning. Keep the right-stick live barrel roll and short vector-thrust maneuvers active for manual evasion. Keep flare handling within the existing offline training capability unless a server-authoritative mode explicitly supports it.

**Missile and flare reliability:** Keep missile disabled state driven by live lock, cooldown, ammo, and pilot state; do not pair imperative per-frame enabling with permanent React `disabled` or `hidden` props. Give incoming-missile warnings a short actionable grace window, and render the flare at the pilot's actual spatial height. Offline Orbital AI should create intermittent guided threats through the same targeting and missile rules so countermeasures can be exercised.

**Why:** On 2026-11-05 the browser reproduction showed that Orbital AI emitted no guided threats, making the hidden flare action unreachable, and React-owned static disabled/hidden props could conflict with per-frame state. A warning that disappears during a touch can also prevent the pilot from responding.

**How to apply:** Keep deterministic simulation changes byte-identical between browser and server copies. Test target acquisition and ammo consumption through the mobile action, then verify an incoming guided missile makes the flare available and a flare removes hostile missiles while emitting a hull-positioned visual event. Keep countermeasures offline-only unless a server-authoritative mode explicitly supports them.

**Shared-universe combat reference:** Use
[`FREE-FLIGHT-COMBAT-HUD-AND-ENCOUNTER-REFERENCE.md`](../../docs/infinite-war/FREE-FLIGHT-COMBAT-HUD-AND-ENCOUNTER-REFERENCE.md)
and its saved landscape screenshot for patrol encounter HUD placement. The
local compatibility trainer is not the universe entry point; shared contact
health must come from server snapshots, and continuous-flight weapon damage
must remain unclaimed until the server combat contract is active.

**Why:** The user asked to carry the Orbital Combat Lab training experience into
the open-universe flight build and provided a landscape combat screenshot. The
existing free-flight stream reports ship integrity but does not yet adjudicate
continuous-flight weapons or rewards.

**How to apply:** Keep live target information in the flight HUD and derive it
only from authenticated snapshots. Preserve the offline trainer as a fallback;
do not imply its local combat state is shared, persistent, or reward-bearing.

**Active-flight sightline and patrol boundary:** Keep the live universe visible.
Hide empty station and public-event panels and detailed docking telemetry while
in open flight; keep expanded station, training, and debrief controls available
when the pilot is docked or has opened the flight menu. Show roaming patrols as
3D ships with restrained faction designations. Only a fresh server snapshot in
an authenticated shared session can expose an in-scene engage action or
authoritative integrity; local patrol projections never open a separate battle
runtime or grant combat outcomes and rewards.

**Why:** On 2026-11-08 the user asked for visible opposing patrol fleets and
same-scene live encounters while removing unnecessary HUD panels that block the
battlefield view.

**How to apply:** Keep active-flight information to connection state, nearby
patrol designation/range, in-range server integrity, and the actions the pilot
can perform now. Do not render an empty activity state as a panel or show
transport rate-limit errors as combat feedback. Keep local preview explicitly
non-authoritative and preserve server-owned combat/reward checks.
