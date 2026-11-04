# Pilot HUD implementation record

Source direction: [`PILOT-EXPERIENCE-RECONSTRUCTION.md`](./PILOT-EXPERIENCE-RECONSTRUCTION.md)

## Current control inventory

- **Offline Orbital Arena:** the left stick controls pitch and yaw with coordinated bank; double-tap an outer sector for a short vertical or lateral vector-thrust pulse. The right stick remains available for fine orientation/aim input; combat actions and map remain separate.
- **Rust Disc flight:** the same two-thumb contract feeds `FlightControlFrame`; left-stick pitch/yaw/bank and edge double-taps replace the old continuous lift/strafe pad. Roll buttons are removed; boost, brake, drift, and threat-only countermeasures remain contextual.
- **Live Wing:** the existing control mapping and server-authoritative input contract are unchanged. The new offline orbital mapping is not silently applied to competitive matches.
- **Input paths:** Orbital Arena touch/key state flows through `Bus` → `readInput` → versioned simulation input; Rust Disc flows through `FlightControlFrame` → `FlightInput`. Existing server authority and result validation remain intact.
- **Rust Disc input path:** touch state flows through `FlightControlFrame` → `FlightInput`; networked expeditions send sanitized controls to the existing authoritative expedition server.

## HUD clutter inventory

The original sources of obstruction were three primary Orbital thumb surfaces, a ten-button maneuver matrix, multiple always-visible text/stat blocks, a permanent radar, settings controls on the flight view, and a separate Rust Disc throttle slider and dense action matrix.

## Refactor plan and target architecture

1. Two primary circular thumb surfaces are implemented: left for analog flight maneuvering, right for aim/orientation.
2. Offline orbital left-stick horizontal input controls yaw and coordinated bank; vertical input controls pitch, while same-sector edge double-taps (285 ms pair window) request 180 ms vertical/lateral vector-thrust pulses. Tap candidates must be under 185 ms and move no more than 11 px; pulses have a 420 ms cooldown.
3. Compact actions use existing input contracts; missiles remain unavailable until the current target/lock conditions are met. Secondary controls are expandable.
4. Orbital Arena and Rust Disc replace the always-visible radar with a map button. Their tactical maps render current local state and known objectives/contacts only.
5. Settings and diagnostics are in pause surfaces; the active HUD keeps compact combat-critical status.
6. Existing simulation, fixed-tick inputs, multiplayer protocol, server-owned combat, and progression/reward rules remain unchanged.

## Camera and mobile plan

Keep the live third-person ship view as the dominant area. The supplied third-person and cockpit images are documented in [`PILOT-IMAGE-REFERENCE-REVIEW.md`](./PILOT-IMAGE-REFERENCE-REVIEW.md). Apply safe-area-aware controls, independent pointer ownership, pointer-cancel reset, and landscape-specific sizing without relying on hover. The shared action-button stylesheet must load with the reusable component so both Orbital Arena and Rust Disc render usable hit targets.

## Regression plan

- Automated: legacy Wing mapping remains unchanged; offline orbital left-stick pitch/yaw/bank, gesture-sector classification, double-tap timing/cooldown, vector-pulse reset, and input interruption.
- Automated: existing orbital deterministic replay, weapons, server-authoritative combat and multiplayer contract suites.
- Browser: launched offline Combat Lab and Rust Disc at an 874×402 landscape viewport; confirmed exactly two thumb surfaces, visible combat actions, and the on-demand map. The shared control styling is verified on both routes.
- Device: physical mobile certification remains separate and must not be claimed from browser screenshots or emulation.

## Status

The full source directives and image-reference reviews are saved. Offline Orbital Arena and Rust Disc use the unified left-stick maneuver mapping and two thumb surfaces; roll controls are replaced by coordinated bank. Workspace typechecking, full workspace tests, and the build passed. Targeted mobile-browser checks passed for left-stick analog input/reset, double-tap thrust feedback, safe areas, and Rust Disc launch; these used browser/software graphics, not a physical phone. No production rollout or deployment was performed.
