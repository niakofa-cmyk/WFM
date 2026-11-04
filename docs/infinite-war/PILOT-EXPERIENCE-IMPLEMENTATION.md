# Pilot HUD implementation record

Source direction: [`PILOT-EXPERIENCE-RECONSTRUCTION.md`](./PILOT-EXPERIENCE-RECONSTRUCTION.md)

## Current control inventory

- **Orbital Arena:** two primary touch surfaces (left flight vector, right aim); compact actions for lock, fire, and eligible missiles; secondary flight maneuvers in an expandable action group; map and pause controls.
- **Rust Disc flight:** two primary touch surfaces (left flight vector, right aim); hold-to-thrust and compact lock/fire/missile actions; secondary rolls, boost, brake, drift, and threat-only flare in an expandable action group; on-demand sector map.
- **Orbital input path:** touch/key state flows through `Bus` → `readInput` → versioned simulation input; multiplayer simulation and result validation remain on the server.
- **Rust Disc input path:** touch state flows through `FlightControlFrame` → `FlightInput`; networked expeditions send sanitized controls to the existing authoritative expedition server.

## HUD clutter inventory

The original sources of obstruction were three primary Orbital thumb surfaces, a ten-button maneuver matrix, multiple always-visible text/stat blocks, a permanent radar, settings controls on the flight view, and a separate Rust Disc throttle slider and dense action matrix.

## Refactor plan and target architecture

1. Two primary circular thumb surfaces are implemented: left for flight-vector maneuvering and right for aim/orientation.
2. Compact actions use existing input contracts; missiles remain unavailable until the current target/lock conditions are met. Secondary controls are expandable.
3. Orbital Arena and Rust Disc replace the always-visible radar with a map button. Their tactical maps render current local state and known objectives/contacts only.
4. Settings and diagnostics are in pause surfaces; the active HUD keeps compact combat-critical status.
5. Existing simulation, fixed-tick inputs, multiplayer protocol, server-owned combat, and progression/reward rules remain unchanged.

## Camera and mobile plan

Keep the live third-person ship view as the dominant area. The supplied third-person and cockpit images are documented in [`PILOT-IMAGE-REFERENCE-REVIEW.md`](./PILOT-IMAGE-REFERENCE-REVIEW.md). Apply safe-area-aware controls, independent pointer ownership, pointer-cancel reset, and landscape-specific sizing without relying on hover. The shared action-button stylesheet must load with the reusable component so both Orbital Arena and Rust Disc render usable hit targets.

## Regression plan

- Automated: left-stick vector axis mapping, independent throttle, input interruption/reset, and existing combat simulation/authority suites.
- Automated: existing orbital deterministic replay, weapons, server-authoritative combat and multiplayer contract suites.
- Browser: launched offline Combat Lab and Rust Disc at an 874×402 landscape viewport; confirmed exactly two thumb surfaces, visible combat actions, and the on-demand map. The shared control styling is verified on both routes.
- Device: physical mobile certification remains separate and must not be claimed from browser screenshots or emulation.

## Status

The full source directive and image-reference review are saved. The two flight routes now use the clutter-reduced HUD and two thumb surfaces, with actions and maps verified in a local browser. Workspace typechecking and tests pass; the WAR FOR MARS package build and its four preview checks pass. No physical-device test, production rollout, or deployment was performed.
