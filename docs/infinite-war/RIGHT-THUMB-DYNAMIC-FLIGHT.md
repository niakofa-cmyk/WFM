# Right-thumb dynamic flight and evasive maneuver foundation

## Direction

The left thumb remains propulsion and coordinated steering. The right thumb
defaults to **Hybrid**: up/down adds physical body-relative vertical thrust,
left/right adds lateral thrust, and diagonals combine normalized vectors while
retaining pitch/yaw aiming. This is movement of the ship, not a camera offset.
Releasing or cancelling a touch sends neutral input; existing assist, drift,
braking and momentum determine how velocity then decays.

Keep both sticks in their established landscape positions. Fire, missiles and
target lock remain reachable. Put profile choices and sensitivity in the flight
menu rather than another information box over the battlefield.

The supplied aircraft screenshot is a control-composition reference, not WFM
artwork or a new atmospheric flight engine. The supplied diagram defines the
input → shared intent → authority → physics → rendering chain.

## Implemented controls

- Hybrid and Aim-only profiles, saved on the device.
- Separate bounded aim-response and vector-thrust gains.
- Neutral touch-down and release/cancel behavior remain unchanged.
- Eight-way outer-edge double taps and two deliberate matching short flicks.
  A quick outward-and-back flick retains its peak direction. Ordinary sustained
  aiming, small tremors, mismatches, cancellation and circle-roll gestures must
  not queue a directional boost.
- Directional bursts use a normalized vector, nominal 0.24-second duration
  (quantized to simulation ticks), 1.2-second recovery and an eight-energy entry
  requirement. Native boost physics then consumes energy at its existing rate,
  uses each hull's acceleration/handling/speed limits and retains hit detection.
  There is no teleport, invulnerability or automatic missile defeat.
- Left steering, primary fire and missile input remain available during a burst.
  The burst temporarily owns lateral/vertical thrust, not the weapon controls.
- Existing local circular roll remains available. Shared circle-roll authority,
  missile countermeasures and additional combat abilities are separate
  capabilities; this slice does not silently enable them.

## Authority and compatibility

`orbital-vector-boost-v1` is an additive shared-flight capability advertised in
the authenticated join response. A client sends burst requests only after the
server offers it. The server validates the direction, increasing sequence,
identity, life, disruptions, fresh input, energy, duration and cooldown. Clients
cannot supply strength, duration, energy, position or a target actor. Repeated
requests cannot bypass recovery. Stale/disconnected input stops active thrust.

The ordinary six-axis input contract is unchanged, so Hybrid translation works
on existing six-axis servers even if they do not offer directional bursts.
Old clients ignore the additional capability metadata. Old servers receive no
new burst packets.

Do not globally relabel historical rules-version-5 replays as version 6 just
because the uploaded proposal recommends it. Native flight physics and legacy
replay shapes are unchanged here. Local training projects the burst into the
already replayable boost/strafe/vertical controls. Shared flight owns its own
burst timer and outcome; a browser timer is not its authority. A future full
roll/ability physics revision needs its own negotiated rules and replay gate.
Competitive Wing and legacy sector adapters retain their existing mappings.

## Source references

- [Verbatim uploaded review](references/WFM-ADVANCED-RIGHT-THUMB-FLIGHT-CONTROLS.source.txt)
- [Landscape control reference](references/right-thumb-aerial-layout.jpeg)
- [Input/authority diagram](references/right-thumb-flight-architecture.png)

The source review's branch, commit and implementation-status statements are
historical observations, not a current repository or Production audit.

## Verification scope

Exercise all eight directions, independent thumbs, fire while moving, classic
profile rollback, release/cancel, gesture exclusivity, normalized diagonal
bursts, energy, cooldown, native hull tuning, projectile avoidance and server
rejection of malformed/replayed requests. Keep unit/physics checks distinct
from interactive training, authenticated staging and physical-device evidence.

The earlier staging survival/12-credit evidence in `STAGING-TEST-REPORT.md`
predates this controller change and must not be reused as proof that these new
gestures have shipped. No staging or Production deployment is authorized by
merely changing these controls. A new paired staging verification must explicitly
check server capability negotiation and maneuvering during real combat.

### Current local evidence

The full workspace typecheck, test suite and production builds passed. The
Combat Lab initial static graph remained below its unchanged gzip budget.
Targeted checks cover the right-thumb mapping/gesture/physics path and the
authoritative burst contract, including duplicate and forged requests.

The testing browser could not create WebGL. A separate bounded local Chromium
SwiftShader check did render the scene and confirmed neutral touch-down, diagonal
thumb input, simultaneous primary fire and physical positive X/Y displacement,
release to zero axes, and the `RIGHT BURST` double-tap feedback. Normal flight
menu interactions also confirmed Aim-only persistence after reload, disabled
vector gain in that profile, and restoring Hybrid. They exposed global flight
hotkeys intercepting range-slider arrow keys; the handler now ignores editable
settings controls, with a targeted regression check. The settings screenshot
timed out; the actual rendered flight screenshot was captured.

This is software-rendered control verification, not missile-evasion statistics,
new authenticated staging evidence, or physical-device certification.
