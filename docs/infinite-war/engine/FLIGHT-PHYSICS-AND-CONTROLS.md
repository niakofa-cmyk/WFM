# Flight physics and control boundaries

## Implemented

`lib/orbital-sim/src/flight.ts` owns `integrateSpatialFlight`: quaternion
orientation, pitch/yaw/roll, body-relative longitudinal/lateral/vertical thrust,
velocity, assisted stabilization, drift, braking, energy-limited boost, speed
limits and obstacle/boundary response. `detmath.ts` supplies replay-sensitive
math. Arena's Orbital update and sector motion use this implementation.

`FlightTuning` currently contains `turnRate`, `handling`, `accel`, `maxSpeed`.
Hull condition influences thrust. This is game-oriented space flight, not a
validated spacecraft mass/torque solver.

## Not implemented by this extraction

Explicit mass, thruster lever arms, torque integration, angular momentum,
lift/drag coefficients, control surfaces and atmosphere-space transitions are
not represented by the current tuning contract. Assisted velocity damping is
not evidence of atmospheric aerodynamics. No atmosphere forces should be added
to vacuum without an explicit environment profile and versioned replay rules.

## One input contract

`pilot-controls.ts` now owns `FlightControlFrame`, neutral construction,
normalization and adapters:

| Boundary | Behavior |
|---|---|
| Normalization | Finite axes clamped to [-1,1]; explicit booleans; recognized bounded tactical intent |
| Orbital step | Signed throttle, six axes, boost/brake/drift, weapons, lock and local maneuver |
| Rust Disc pilot → Orbital | Invert yaw, roll and strafe exactly once; preserve pitch/vertical/throttle |
| Sector wire | Existing [0,1] throttle; negative request becomes brake; tactical maneuver omitted |
| Sector → spatial integrator | Same shared pilot-axis conversion; operation scale and world remain explicit |

The UI's original `flight-control.ts` path re-exports these library functions.
No reverse thrust, maneuver packet or authority permission is added to sector
networking. The shared module imports only sector **types**, avoiding a runtime
cycle with the sector integrator.

## Rules preservation and proof

No runtime ID, numerical tuning, energy cost, timestep, replay field order or
valid-input mapping was intentionally changed. Differential tests compare
position, velocity, quaternion and energy for four flight cases over 120 ticks.
The sector and direct Orbital integrator must match exactly at the same scale.
Existing historical replay fixtures must continue passing.

Next dynamics enhancement must introduce explicit environment/tuning semantics,
pin issued runs and room protocols, and compare old/new trajectories before
activation. A visual ship roll alone is not flight-physics certification.
