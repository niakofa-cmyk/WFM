# Pilot HUD implementation record

Source direction: [`PILOT-EXPERIENCE-RECONSTRUCTION.md`](./PILOT-EXPERIENCE-RECONSTRUCTION.md)

## Current control inventory

- **Orbital Arena:** left throttle/strafe stick, center vector-thrust stick, right aim stick; a grid of touch buttons for lift, roll, boost, brake, slide, drift, and assist; text keyboard legend; always-visible radar; persistent hold, camera-shake, and audio controls; a diagnostic telemetry panel.
- **Rust Disc flight:** rotational stick, vector stick, throttle slider, and a multi-button combat/maneuver grid; camera and pause buttons; persistent performance readout; status, objective, target, and missile text.
- **Orbital input path:** touch/key state flows through `Bus` → `readInput` → versioned simulation input; multiplayer simulation and result validation remain on the server.
- **Rust Disc input path:** touch state flows through `FlightControlFrame` → `FlightInput`; networked expeditions send sanitized controls to the existing authoritative expedition server.

## HUD clutter inventory

The main sources of obstruction are three primary Orbital thumb surfaces, a ten-button maneuver matrix, multiple always-visible text/stat blocks, a permanent radar, and settings controls on the flight view. Rust Disc separately has a throttle slider, two sticks, and a dense action matrix.

## Refactor plan and target architecture

1. Use two primary circular thumb surfaces: left for flight-vector maneuvering and right for aim/orientation.
2. Replace maneuver grids and text tabs with compact circular actions that map to existing controls. Keep only immediately useful actions visible; gate missiles by lock/ammo and show other actions only when available.
3. Replace the permanent radar with a map button and an expandable tactical view. Keep detected contacts subject to existing visibility rules.
4. Move settings and diagnostics into pause/settings surfaces. Keep only combat-critical status in the active HUD.
5. Preserve the existing simulation, fixed-tick inputs, multiplayer protocol, server-owned combat, and progression/reward rules.

## Camera and mobile plan

Keep the live third-person ship view as the dominant area. Review the current chase-camera framing and smoothing before changing camera physics. Apply safe-area-aware controls, independent pointer ownership, pointer-cancel reset, and landscape-specific layout without relying on hover.

## Regression plan

- Automated: two simultaneous pointers, axis mapping, touch interruption/reset, hold/pulse actions, readiness/disabled states, map open/close, and control-to-simulation coverage.
- Automated: existing orbital deterministic replay, weapons, server-authoritative combat and multiplayer contract suites.
- Visual: screenshot at landscape mobile and a narrow portrait viewport; verify the ship view and controls do not overlap.
- Device: physical mobile certification remains separate and must not be claimed from browser screenshots or emulation.

## Status

The source directive is saved and the current app has been audited. The HUD/control refactor and tests are still in progress; this record will be updated after verification.
