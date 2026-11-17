# Phases 1–3: two-thumb flight and evasive maneuvers

## Owner's direction and retained references

Implement analog right-thumb movement, eight-way directional bursts, and
advanced evasive controls together as one playable package in the existing
Orbital foundation. Preserve Three.js as the primary presentation technology,
the native companion path, deterministic flight, and server authority.

The complete supplied documents are retained without rewriting:

- [Right-thumb controls and Phases 1–3](references/PHASE-1-3-RIGHT-THUMB-CONTROLS.source.txt).
- [Fleet forensic evaluation and expansion goals](references/FLEET-FORENSIC-AND-TACTICAL-EXPANSION.source.txt).
- [Multi-fleet action and performance goals](references/UNIFIED-MULTI-FLEET-AERIAL-ACTION.source.txt).

These are references, not current verification reports. Their historical
branch/commit claims and missing-feature findings must be checked against
current source. The current implementation already contained hybrid movement,
eight-way gestures and circular rolls when this package was reviewed.

The fleet document is a wider roadmap: complete and verify existing hulls,
abilities, weapons and distinct identities before expanding fleet roles and
capital warfare. This controls package does not claim completion of that
entire roadmap.

## One control system, three saved profiles

The left thumb remains propulsion and coordinated steering. The right thumb
now offers three device-local, persisted profiles:

| Profile | Right-thumb orientation | Right-thumb translation | Directional bursts |
| --- | --- | --- | --- |
| Hybrid | Aim/pitch/yaw | Lateral/vertical, including normalized diagonals | Available |
| Aim only | Classic aim/pitch/yaw | None | Not available |
| Vector | No right-thumb rotation | Lateral/vertical, including normalized diagonals | Available |

Vector mode enables heading-stable gun-line evasion: move the hull sideways,
up/down or diagonally without turning it with that same thumb. Left steering,
gyro input and explicit roll commands remain independent; it is not an
automatic target tracker or heading lock.

The flight menu exposes all three profiles. Aim response is inactive in vector
mode; vector response is inactive in aim-only mode. Settings reload through the
existing device-local profile store. Invalid data falls back to the original
hybrid default.

No new physics loop, camera-only movement or position teleport was introduced.
The profile lowers to existing shared flight axes; no historical simulation
version or replay rule was changed.

## Phase 2: eight-way bursts, with interruption safeguards

Both hybrid and vector profiles use the existing deliberate matching tap/flick
recognizer. Single aiming drags, mismatched directions and tiny movements do
not intentionally become burst commands. Diagonal strength remains normalized.

Offline burst sampling now uses the supplied input sample time consistently.
Repeated sampling at the same timestamp cannot consume the duration twice.
Invalid clocks are rejected, backward clock corrections cancel an active burst,
and input interruption cancels the burst without clearing its remaining
cooldown. Entering classic aim, legacy Orbital controls or Wing cannot preserve
an old burst and resurrect it after returning.

Offline requests also reject missing/dead/rooted/jammed pilot state at the
actual control callback, rather than only checking energy. The simulation's
existing handling, thrust, speed cap and energy rules remain authoritative.
Shared-flight bursts continue through the existing negotiated server-owned
capability; no client timer determines their online activation or duration.

## Phase 3: evasion and recovery in the existing native simulation

- Use vector mode and lateral bursts to cross an enemy gun line while keeping
  held primary fire active.
- Use ascent/descent or diagonal bursts as vertical breaks, not an automatic
  missile escape guarantee.
- Combine an offline circular roll with a directional burst and held fire
  through the same native input frame. Roll and boost retain their energy
  constraints; they do not grant immunity.
- Use local vector drift to retain momentum, release to resume the configured
  assistance, and brake to damp velocity for recovery. Existing inertial-assist
  toggle behavior is preserved rather than forcibly changing the pilot's mode.
- Countermeasures remain a separate tactical action, not an alias for a dodge.

Stick sides, sizes and positions are unchanged. Active-flight firing, missile,
boost and flare placement remains intact. Pausing releases both primary sticks;
changing the right-thumb profile clears captured axes, pending taps/flicks and
circle-roll input. The extra help stays in the flight menu rather than blocking
the battlefield.

## Shared-flight enemy selection and missile lock

The shared-flight lock control cycles only to a living hostile patrol already
participating in one of the pilot's active encounters and inside the streamed
universe bubble. Order is server-selected and stable. A pilot's selected enemy
stays selected while maneuvering or turning, rather than silently switching
when another contact crosses the forward cone. Dead, departed, friendly or
out-of-stream targets are rejected or cleared. Repeated selection is
rate-limited, and stale sequences or client-supplied actor IDs are rejected.

Shared lock state (current enemy, native lock progress, missile cooldown,
ammunition and launch readiness) is sent separately from strict flight
snapshots. The button and target HUD use that server report. Readiness uses the
existing native alive, aiming-cone, range, target and ammunition checks;
selection alone is not a missile lock. Selection does not add a
client-authored target ID to the historical flight input.

Regression checks cover hostile-only switching, selection held through
continuous flight input, native missile acquisition while maneuvering,
launch against the selected actor, and clearing the old charge when switching
or when that enemy is destroyed.

### Honest multiplayer boundary

Hybrid/vector analog axes and negotiated eight-way bursts use the existing
shared-flight path. **Local circular-roll intents and KeyT drift are not an
online capability upgrade.** The unsupported drift button is now hidden in
shared/online flight instead of appearing to work while serialization discards
it. Supported braking and inertial-assist controls remain available.

Phase 6 must separately negotiate any new shared drift/circle-roll capability,
including duration, energy, cancellation, sequence/reconnect validation and
replay compatibility. Do not silently add those intents to legacy Wing or
sector protocols.

## Performance and fleet goals retained

Use one continuous battlefield and existing renderer lifetime. Reduce measured
hot-loop allocation, reuse bounded buffers, batch/instance compatible visuals,
and keep distant fleet simulation separate from detailed nearby combat.
Preserve lazy Three.js loading and existing bundle audits.

Measure frame-time percentiles, CPU/GPU work, draw calls, triangle counts,
memory/GC behavior, network timing and interpolation under representative
multi-fleet load on supported physical devices. “Zero lag,” “zero GC” and “0%
frame drops” are not certified properties of a typed-array example.

Never implement the uploaded sample's hard-coded player accounts or direct
enemy-health zeroing. A tactical success must come from movement, targeting,
actual weapons, collision, damage and persistent settlement. Friendly traffic
and the proposed 20% friendly force target are not proof of AI assistance.

## Verification and remaining gates

Native regressions cover eight-direction translation, heading stability,
simultaneous steering/fire, profile reload and corrupt storage, boost
energy/cooldown/timing, mode/interruption safety, momentum/assistance/braking,
and combined roll + diagonal boost + fire. Existing tests cover gesture
recognition, missile/weapon behavior, multiplayer combat and adapter isolation.

Validation on 2026-11-09 passed:

- Full workspace type-check.
- All 734 workspace tests: 59 scripts, 249 API and 426 game tests.
- All workspace builds, including the main-app and standalone Combat Lab
  lazy-loading audits; no budget threshold was weakened.
- Byte-for-byte comparison of the newly retained source copies.
- Restarted game workflow and public Combat Lab entry screenshot, without a
  browser runtime error. The screenshot does not open the in-flight menu.

Automated input/physics tests are not physical touch-device certification or a
new authenticated staging flight. Do not infer statistically improved survival
against guided missiles, capital weapons or multiple fleets from a straight
projectile-corridor test. Those remain measured-combat follow-ups.
