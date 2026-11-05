# WAR FOR MARS: INFINITE WAR
## LEFT THUMB FLIGHT CONTROL CONSOLIDATION
### Dynamic Analog Maneuvering, Gesture-Triggered Flight, and Unified Mobile Flight Architecture

**Repository:** https://github.com/niakofa-cmyk/WFM

**Primary engine:** Orbital Combat Lab

**Target:** Latest verified WFM staging source.

## 1. MISSION

Reevaluate and upgrade the current Orbital Combat Lab mobile flight-control system.

The existing pilot controls are a good foundation. However, too many flight maneuvers remain dependent on separate buttons.

We want the majority of ordinary flight maneuvers consolidated into one intelligent, dynamic left-thumb joystick.

The left joystick must become the primary spacecraft maneuvering controller.

The pilot should be able to fly, climb, dive, turn, bank, and execute special directional maneuvers without having to reach for separate UP, DOWN, LEFT, RIGHT, ROLL, or SLIDE buttons.

The objective is:

**ONE PRIMARY LEFT THUMB FLIGHT CONTROLLER THAT OPERATES THE MAJORITY OF THE SPACECRAFT'S FLIGHT AND MANEUVERING CAPABILITIES.**

Preserve the current good elements of the flight build. Improve the input architecture rather than replacing working physics or combat systems unnecessarily.

### Current Orbital mobile-control contract

For offline Orbital Combat Lab, the left stick is the propulsion and steering controller:

- Drag upward for forward throttle; drag downward for reverse thrust.
- Drag left or right to turn with coordinated bank. Diagonal input must turn and propel at once.
- Keep pitch/aim orientation on the right stick so it remains usable while the left thumb flies.
- Keep double-tap edge gestures distinct from normal drag: upper/lower taps pulse vertical thrust, left/right taps pulse lateral thrust.
- The up-arrow action is vertical thrust, not forward propulsion. Do not require a separate forward button.
- Preserve the existing Rust Disc and live Wing mappings; this Orbital-specific behavior is not a claim that their current controls are identical.

## 2. AUDIT THE EXISTING IMPLEMENTATION

Inspect:

- `Arena.tsx`
- `input.ts`
- `orbital-flight.ts`
- `orbital-sim.ts`
- The shared `@workspace/orbital-sim` implementation.
- Corresponding API-server simulation and input types.
- Existing mobile control tests.
- Existing pointer cancellation and interruption handling.

Document exactly how each joystick axis currently affects spacecraft movement.

Identify every existing maneuver button and the corresponding simulation action.

Verify the actual physics behavior rather than assuming that an input labeled UP produces a particular flight result.

Create a control mapping matrix before changing the implementation.

## 3. BUILD ONE INTELLIGENT LEFT THUMB JOYSTICK

Retain the existing circular joystick foundation.

Improve it to support:

- Dynamic touch origin.
- Analog movement.
- Eight-direction input.
- Smooth directional transitions.
- Adjustable sensitivity.
- Adjustable dead zones.
- Adjustable response curves.
- Configurable joystick radius.
- Multi-touch reliability.
- Immediate release-to-neutral behavior.
- Pointer cancellation recovery.
- Gesture recognition.
- Context-aware maneuvering.

The joystick must continuously produce normalized directional input.

Do not make the player press separate directional buttons to perform ordinary flight.

## 4. IMPLEMENT THE PRIMARY FLIGHT AXES

The left joystick should control the primary flight axes.

### Horizontal axis

Implement coordinated turning and maneuvering.

Depending on the selected flight model, support:

- Yaw.
- Banking.
- Coordinated turn behavior.
- Lateral translation where appropriate.

Do not make the ship rotate in an unnatural or disconnected way.

A left turn should produce convincing leftward aircraft banking and appropriate heading change.

A right turn should produce the corresponding rightward behavior.

### Vertical axis

For offline Orbital Combat Lab, use the left stick's vertical axis for signed propulsion:

- Push upward: increase forward throttle.
- Push downward: apply reverse thrust.
- Combine vertical propulsion with horizontal steering without cancelling either input.

Keep pitch/aim orientation on the right stick. Use the left stick's upper/lower double-tap gestures and the up-arrow action for separate vertical translation. Do not silently map the normal up/down drag back to pitch or vertical translation in this Orbital control mode.

Do not change Rust Disc's existing local flight controls or live Wing's mapping as part of this Orbital-specific adjustment.

## 5. IMPLEMENT DOUBLE-TAP MANEUVER TRIGGERS

Integrate special maneuvers directly into the left joystick interaction surface.

The first requested gestures are:

### Double-tap upward

When the pilot double-taps the upper joystick gesture zone:

- Trigger an upward vertical-thrust maneuver.
- Apply a controlled vertical impulse or short-duration thrust.
- Produce visible spacecraft response.
- Preserve the current heading unless the pilot is also providing rotational input.

### Double-tap downward

When the pilot double-taps the lower joystick gesture zone:

- Trigger downward vertical thrust.
- Produce controlled downward movement.
- Preserve the current heading unless another flight input is active.

### Gesture recognition requirements

Implement reliable gesture detection.

- Recognize two distinct taps in the same directional sector.
- Use a configurable double-tap interval, initially approximately 250–300 milliseconds.
- Distinguish a tap from a continuous joystick drag.
- Ignore accidental gestures while the thumb is making an ordinary sustained maneuver.
- Prevent duplicate activation.
- Add a short configurable maneuver cooldown.
- Provide subtle visual and audio feedback.
- Reset gesture state after interruption, pointer cancellation, and release.

Do not activate vertical thrust merely because the joystick is held upward or downward.

Normal analog flight input and double-tap special maneuver input must remain distinguishable.

## 6. ADD CONTEXTUAL MANEUVERING

After the primary left-stick system works, support optional advanced maneuvers through the same control surface.

Evaluate:

- Quick directional evasive maneuver.
- Rapid climb.
- Rapid dive.
- Barrel roll.
- Inertial drift.
- Precision stabilization.
- Boost-assisted turning.
- Counter-thrust.
- Lateral space maneuvering.

Do not add every maneuver as a new button.

Use directional gestures, double taps, or carefully designed combinations where they are reliable and discoverable.

Not every maneuver needs to be assigned to the joystick if doing so would make controls confusing.

Keep the most important actions intuitive.

## 7. PRESERVE THE RIGHT THUMB AND COMBAT INTERFACE

The right side should remain dedicated primarily to aiming and combat.

Preserve:

- Weapon aiming.
- Target alignment.
- Target lock.
- Primary firing.
- Missile launch.
- Special combat abilities.
- Other essential combat actions.

Do not overload the right thumb with ordinary spacecraft movement.

The pilot should be able to maneuver with the left thumb while simultaneously aiming and engaging with the right thumb.

## 8. REMOVE REDUNDANT LEFT-SIDE MANEUVER BUTTONS

Once each capability has been successfully integrated and tested, remove the separate orbital maneuver button cluster.

Specifically remove redundant:

- UP.
- DOWN.
- ROLL LEFT.
- ROLL RIGHT.
- SLIDE LEFT.
- SLIDE RIGHT.
- Other buttons that duplicate left-stick capabilities.

Boost, brake, and inertial-flight functions should be evaluated individually.

If they are not naturally suitable for a gesture, retain them as compact, clearly actionable controls rather than forcing awkward gestures.

Do not remove a working function until the replacement has passed its tests.

## 9. IMPROVE THE FLIGHT DYNAMICS

The joystick must connect to a coherent flight model.

Improve:

- Rotational response.
- Pitch acceleration.
- Yaw response.
- Banking.
- Angular damping.
- Thrust response.
- Vertical thrust.
- Inertial drift.
- Momentum.
- Counter-thrust.
- Flight stabilization.
- Acceleration and deceleration.

The ship should respond smoothly and predictably.

Avoid abrupt snapping, uncontrolled spinning, or excessive sensitivity.

Different spacecraft should retain their individual handling characteristics.

Do not apply atmospheric aerodynamic lift or drag indiscriminately in vacuum.

## 10. CREATE A SHARED INPUT CONTRACT

All control devices must feed into a consistent simulation input structure.

Support:

- Mobile touch.
- Keyboard.
- Gamepad.
- Optional gyroscope.

Use one canonical input representation for the browser and server simulation.

Any changes to the deterministic competitive simulation must be mirrored on the API server.

Preserve client/server simulation parity and replay validation.

Do not change competitive damage, reward, authentication, or server-authority rules as part of this control task.

The Orbital Combat Lab's existing restriction against live online matches must remain in place unless a separately authorized multiplayer integration is developed.

## 11. TESTING REQUIREMENTS

Create automated tests for:

- Analog left-stick movement.
- Eight-direction movement.
- Pitch response.
- Yaw response.
- Coordinated banking.
- Forward and reverse throttle from left-stick vertical drag.
- Simultaneous propulsion and steering on diagonal drag.
- Vertical ascent action independent of forward/reverse throttle.
- Double-tap ascent.
- Double-tap descent.
- Gesture timing.
- Gesture cooldown.
- Tap versus drag discrimination.
- Simultaneous left and right thumb operation.
- Right-thumb aiming while maneuvering.
- Touch release.
- Pointer cancellation.
- Lost pointer capture.
- Browser interruption.
- Orientation changes.
- Input reset.
- Simulation determinism.

Test all supported flight models.

Verify that existing flight functionality does not regress.

## 12. PHYSICAL MOBILE TESTING

Use the actual Android Chrome device test process.

Test:

- Slow precision movement.
- Rapid directional changes.
- Continuous forward and reverse throttle from the left stick.
- Forward thrust while turning on a diagonal stick drag.
- Double-tap ascent and descent.
- Coordinated turns.
- Evasive maneuvers.
- Simultaneous aiming and flight.
- Combat while maneuvering.
- Touch interruption.
- Release-to-neutral behavior.

Record a gameplay demonstration.

Do not treat desktop responsive emulation as physical-device certification.

The existing mobile certification report is PARTIAL; update it only with genuine new evidence.

## 13. IMPLEMENTATION SEQUENCE

Phase A: Audit current controls and simulation mappings.

Phase B: Refactor the left joystick into a multi-axis analog flight controller.

Phase C: Implement double-tap vertical maneuver triggers.

Phase D: Implement coordinated banking and improved rotational dynamics.

Phase E: Integrate advanced maneuvers where appropriate.

Phase F: Remove redundant maneuver buttons after replacement verification.

Phase G: Test simultaneous flight and combat.

Phase H: Perform physical Android validation and publish the implementation report.

Work in staging using reviewable changes.

Do not merge to main or deploy to Production without authorization.

## 14. FINAL ACCEPTANCE CRITERIA

The work is complete when:

1. The left joystick controls the majority of normal flight maneuvers.
2. The pilot can propel forward or in reverse and turn simultaneously without separate forward/reverse buttons.
3. Double-tap upward triggers a controlled ascent maneuver.
4. Double-tap downward triggers a controlled descent maneuver.
5. Coordinated banking feels natural.
6. The right thumb can aim and fight simultaneously.
7. Redundant left-side maneuver buttons are removed.
8. No more than two primary thumb-controlled maneuver surfaces remain.
9. Existing spacecraft physics and combat behavior remain functional.
10. Browser/server simulation parity remains intact.
11. Mobile touch handling is reliable.
12. The new controls are demonstrated on an actual supported mobile device.

**FINAL DIRECTIVE: MAKE THE LEFT THUMB JOYSTICK THE PILOT'S PRIMARY FLIGHT CONTROL SYSTEM. CONSOLIDATE THE MANEUVERS, IMPROVE THE FLIGHT RESPONSE, AND ELIMINATE UNNECESSARY SECONDARY CONTROL BUTTONS.**