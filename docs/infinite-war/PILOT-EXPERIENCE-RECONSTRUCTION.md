# WAR FOR MARS: INFINITE WAR
## PILOT EXPERIENCE RECONSTRUCTION — MINIMAL HUD, ADVANCED FLIGHT CONTROLS & COMBAT-FIRST MOBILE INTERFACE

**Repository:** https://github.com/niakofa-cmyk/WFM

**Primary engine:** Orbital Combat Lab

**Reference:** Supplied Metal Storm pilot gameplay screenshot.

**Mission:** Completely redesign and implement the spacecraft pilot experience, flight controls, combat interface, and visual presentation for War for Mars: Infinite War.

---

## 1. PRIMARY OBJECTIVE

The current flight screen is cluttered, visually disorganized, and overloaded with unnecessary control boxes, directional buttons, tabs, and overlapping interface elements.

This is not the intended experience.

We want a clean, immersive, professional mobile space-combat experience in which the pilot can see the spacecraft, understand the immediate combat situation, maneuver naturally, and execute combat actions with minimal effort.

Reconstruct the pilot interface around the following principle:

**THE SPACECRAFT AND THE COMBAT EXPERIENCE MUST BE THE CENTER OF THE SCREEN. THE CONTROLS MUST SUPPORT THE EXPERIENCE, NOT DOMINATE IT.**

This is a complete flight-interface and control-system redesign, not a cosmetic adjustment.

Inspect the current implementation before modifying it.

---

## 2. REMOVE THE EXISTING FLIGHT-SCREEN CLUTTER

Audit the current flight HUD and remove unnecessary interface elements.

Specifically remove:

- All unnecessary rectangular control panels.
- Box-shaped maneuver tabs.
- Separate UP, DOWN, LEFT, and RIGHT flight buttons.
- The current three-circle maneuver-control arrangement.
- Duplicated controls.
- Permanent settings panels.
- Unnecessary information panels.
- Redundant navigation controls.
- Interface elements that are not actionable.
- Decorative buttons that do not perform an actual gameplay function.

Do not simply hide the old controls while leaving their input handlers active.

Remove or refactor the underlying obsolete UI and input logic safely.

Do not remove actual gameplay capabilities just because their existing controls are being removed.

Every useful capability must be reassigned to the new control architecture or an appropriate contextual interface.

---

## 3. BUILD A CLEAN PILOT HUD

Design the flight screen in landscape mobile orientation.

The central and largest portion of the screen must remain dedicated to the live spacecraft view.

The pilot must have an unobstructed view of:

- Their spacecraft.
- The flight environment.
- Enemy spacecraft.
- Friendly spacecraft.
- Incoming threats.
- Targeting information.
- Combat effects.
- Navigation indicators.

The HUD should be lightweight and translucent.

Use minimal, carefully positioned information:

- Shield status.
- Hull integrity.
- Speed.
- Target information.
- Missile availability.
- Weapon readiness.
- Small directional threat indicators.
- Compact radar or map access.

Do not permanently display every statistic.

Prioritize only information needed for immediate flight and combat decisions.

Settings, control customization, spacecraft configuration, and secondary information must move to pause menus or dedicated screens.

---

## 4. IMPLEMENT A TWO-THUMB FLIGHT CONTROL SYSTEM

The preferred architecture is two primary circular touch-control surfaces.

Do not implement three primary maneuver joysticks.

### LEFT THUMB — FLIGHT CONTROL

Implement one dynamic virtual joystick.

For offline Orbital Combat Lab, it is the primary propulsion and steering input:

- Drag up for forward throttle and down for reverse thrust.
- Drag left or right to turn with coordinated bank.
- Combine diagonal drag so the spacecraft turns while continuing forward or reverse.
- Use same-sector edge double-taps for separate vertical and lateral vector-thrust pulses.

Do not use ordinary up/down drag as pitch in this Orbital control mode. Keep pitch and aim orientation on the right stick so both thumbs can operate at once.

Rust Disc's existing implementation is a separate legacy mapping: its left stick controls yaw/pitch and its thrust action controls forward throttle. Do not claim that mapping is identical to the revised offline Orbital mapping or change it incidentally.

Keep the target-lock action and collapsible flight-maneuver menu on the left control panel. Keep guided missiles and primary fire beside the right aim stick. Do not show a duplicate forward-thrust button by default; the left stick already provides continuous forward/reverse throttle, while the up-arrow is reserved for vertical thrust.

The control should support:

- Dynamic joystick origin.
- Adjustable sensitivity.
- Configurable dead zones.
- Smooth response.
- Adjustable input curves.
- Centering behavior.
- Touch cancellation and recovery.
- Multi-touch operation.

### RIGHT THUMB — AIMING AND ROTATIONAL CONTROL

Implement one second dynamic circular control.

For offline Orbital, it provides:

- Weapon aiming.
- Target alignment.
- Pitch/orientation adjustment while the left thumb maintains propulsion and turning.

The control must be configurable so players can choose an appropriate balance between aiming and roll.

Do not create another permanent directional-button cluster.

### SIX-DEGREE-OF-FREEDOM SUPPORT

The interface must control the full underlying spacecraft movement model.

The main simulation must continue supporting:

- Pitch.
- Yaw.
- Roll.
- Forward thrust.
- Reverse thrust.
- Lateral thrust.
- Vertical thrust.
- Acceleration.
- Deceleration.
- Momentum.
- Inertia.
- Angular velocity.
- Flight stabilization.

Do not artificially limit the actual physics simulation to two dimensions.

Use contextual actions and configurable gestures for functions that cannot be conveniently represented by the two primary thumb controls.

All controls must connect to the actual Orbital Combat Lab input and simulation architecture.

---

## 5. IMPLEMENT THE COMBAT ACTION INTERFACE

Provide only useful, actionable combat controls.

Prioritize:

1. Primary weapon firing.
2. Missile launch.
3. Target lock.
4. Target switching.
5. Boost.
6. Counter-thrust/braking.
7. Shield activation.
8. Countermeasures, if supported.
9. Radar/map access.

Use clean, compact, circular icon controls.

Avoid rectangular tabs and large panels.

Combat icons must have clear visual states:

- Ready.
- Active.
- Cooling down.
- Unavailable.
- Out of ammunition.
- Locked or invalid.

Each control must execute a real gameplay action.

Do not create visual-only controls.

Use existing server-authoritative combat pathways for competitive multiplayer actions.

The client must never bypass server validation for weapon firing, damage, ammunition, or combat results.

---

## 6. REDESIGN THE CAMERA AND PILOT VISUAL EXPERIENCE

Use the supplied Metal Storm screenshot as a visual reference for the pilot experience.

Study:

- Camera distance.
- Ship framing.
- Field of view.
- Ship visibility.
- Environmental depth.
- Targeting presentation.
- Combat readability.
- Flight perspective.
- HUD positioning.
- Overall screen composition.

Create an original War for Mars visual implementation inspired by the reference.

The spacecraft should feel powerful, responsive, and physically present in the environment.

Implement or improve:

- Third-person chase camera.
- Camera smoothing.
- Velocity-sensitive camera behavior.
- Flight banking.
- Maneuver-responsive camera movement.
- Acceleration feedback.
- Camera collision handling.
- Target tracking.
- Combat camera feedback.
- Optional cockpit or alternate camera perspective where supported.

The camera must not make flight disorienting.

Provide configurable camera sensitivity and perspective settings outside the primary combat screen.

---

## 7. IMPROVE SPACECRAFT MANEUVERING

The new interface must take advantage of the advanced capabilities of Orbital Combat Lab.

Implement appropriate control mappings for:

- Six-axis flight.
- Precision maneuvering.
- High-speed turns.
- Banking.
- Roll maneuvers.
- Evasive maneuvers.
- Pursuit.
- Interception.
- Target tracking.
- Controlled acceleration.
- Controlled deceleration.
- Boost-assisted maneuvers.
- Stabilized flight.

Where supported by the physics model, introduce optional maneuver assistance.

Examples:

- Flight stabilization.
- Assisted targeting.
- Optional aim assistance.
- Precision maneuver mode.
- Temporary boost.
- Counter-thrust.
- Inertial drift correction.

Assistance must not remove meaningful player control or create unfair competitive advantages.

---

## 8. MAP AND RADAR INTEGRATION

Do not place a large map permanently over the flight experience.

Implement a compact tactical radar or map indicator.

When selected, it should expand into a separate tactical overlay.

The expanded map should display relevant information:

- Player location.
- Friendly units.
- Enemy contacts where detected.
- Objectives.
- Sector boundaries.
- Waypoints.
- Operational destinations.

The pilot must be able to close the overlay and immediately return to unobstructed flight.

Do not expose enemy information that the player has not legitimately detected.

---

## 9. MOBILE-FIRST INPUT ENGINEERING

Implement the control architecture using the existing game's actual input and simulation pathways.

Support:

- Reliable multi-touch.
- Touch ownership.
- Independent left/right thumb input.
- Touch cancellation.
- Pointer loss.
- Sensitivity adjustment.
- Dead-zone adjustment.
- Adjustable joystick size.
- Configurable control positions.
- Landscape orientation.
- Optional gyroscope.
- Gamepad support.
- Keyboard support for development.

Ensure that controls never become stuck when a touch is interrupted.

Ensure that pressing a combat icon does not accidentally trigger a maneuver.

Ensure that maneuver input does not accidentally fire a weapon.

Provide appropriate input smoothing without introducing excessive latency.

---

## 10. VISUAL QUALITY AND PERFORMANCE

The flight interface must remain lightweight.

Do not introduce unnecessary rendering overhead.

Optimize:

- HUD rendering.
- Camera updates.
- Input processing.
- Target indicators.
- Radar updates.
- Combat effects.
- Mobile GPU performance.

Preserve the performance of the Orbital Combat Lab simulation.

Maintain responsiveness during intense multiplayer combat.

---

## 11. IMPLEMENTATION AND MIGRATION

First audit the current flight interface, control handlers, camera, HUD, and input architecture.

Produce:

- Current control inventory.
- Existing input-flow diagram.
- HUD clutter inventory.
- Control-removal plan.
- New control architecture.
- Camera redesign plan.
- Mobile implementation plan.
- Regression test plan.

Then implement the new pilot experience.

Do not create a parallel control engine if the existing Orbital Combat Lab architecture can support the redesign.

Refactor existing components where appropriate.

Preserve underlying flight physics, weapons, multiplayer authority, and game-mode compatibility.

Do not delete working capabilities.

---

## 12. REQUIRED TESTING

Test on actual mobile-sized viewports and supported devices.

Verify:

- Two-thumb simultaneous maneuvering.
- Pitch and yaw.
- Roll behavior.
- Aiming.
- Primary firing.
- Missile launching.
- Target locking.
- Boost.
- Braking.
- Multi-touch reliability.
- Touch interruption.
- Camera responsiveness.
- HUD visibility.
- Map opening and closing.
- No accidental control activation.
- No overlapping controls.
- No screen obstruction.
- No regression in Orbital Combat Lab physics.
- No regression in multiplayer combat.

Test at realistic mobile resolutions and aspect ratios.

Where physical device testing is unavailable, clearly distinguish browser emulation from actual device certification.

---

## 13. ACCEPTANCE CRITERIA

The redesign is not complete until:

1. The three existing maneuver circles have been replaced with no more than two primary thumb-controlled maneuver surfaces.
2. Separate directional maneuver buttons are removed.
3. Unnecessary rectangular control panels are removed.
4. The spacecraft and environment occupy the visual center of the experience.
5. The flight HUD is clean and minimal.
6. The tactical map is accessible without permanently obstructing flight.
7. Every visible combat icon performs an actual action.
8. Six-degree-of-freedom flight remains available.
9. The pilot can fly, aim, and engage in combat simultaneously.
10. The controls work reliably on mobile.
11. The Metal Storm reference direction has informed the original WFM presentation.
12. Existing combat and multiplayer systems remain functional.

---

## 14. REQUIRED DELIVERABLES

Deliver:

- Redesigned pilot HUD.
- New two-thumb control system.
- Refactored flight input architecture.
- Updated camera and spacecraft presentation.
- Tactical map/radar interface.
- Contextual combat action controls.
- Mobile control configuration.
- Automated regression tests.
- Mobile viewport screenshots.
- Gameplay demonstration.
- Implementation report.
- Remaining limitations.

Work in the current WFM staging development path.

Do not merge to main or deploy to production without explicit authorization.

Do not report success until the actual implementation has been tested.

**FINAL DIRECTIVE: REMOVE THE CLUTTER. PRESERVE THE GAMEPLAY. CONSOLIDATE THE CONTROLS. MAKE THE PILOT EXPERIENCE FEEL LIKE A PROFESSIONAL SPACE-COMBAT GAME.**