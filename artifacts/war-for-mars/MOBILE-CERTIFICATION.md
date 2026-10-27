# WAR FOR MARS — Mobile Certification

**Status: NOT CERTIFIED — physical-device runs have not been performed.**

This report separates automated control/lifecycle checks from Android Chrome and iOS Safari evidence. Desktop preview, browser emulation, and source inspection do not count as physical-phone performance results.

## Build under test

- Source commit: `7eae96dfb695f8658f452ca91e8d9c3b643bc2c3`
- Automated checks: workspace typecheck, all 40 automated tests, and production builds passed.
- Physical-device test date / tester: not run
- Preview-only check: the public sign-up form rendered at 402×874 in the development preview. Clerk showed development keys; no account was created. This is not physical-device evidence.

## Automated coverage and code checks

The automated mobile-control tests cover:

- Combining both touch sticks with fire, lock, ability, evade, power selection, and gyro aim.
- Clearing held keys, sticks, fire, and latched actions through the reset helper used by focus-loss handling.
- Gyro permission denial while retaining touch steering.
- Gyro permission grant, calibration, orientation reset, and listener cleanup when disabled.

The game also clears held input and pauses the local simulation when the document is hidden, resizes the arena after device orientation and visual-viewport changes, and resets a stick on pointer capture loss. These are code-level checks; they do not prove browser behavior on a physical device.

## Proposed acceptance gates

Record the raw trace and device/browser versions before marking a gate passed. These are project targets, not measurements from the current run.

| Measure | Proposed pass target |
| --- | --- |
| Playable frame rate | At least 55 FPS average on a 60 Hz display during a full battle |
| Frame pacing | p95 frame time at or below 20 ms; p99 at or below 33.4 ms; fewer than 1% of frames over 50 ms |
| Touch response | Ship movement is visibly responsive within 100 ms of a stick gesture; no stuck input after release or cancellation |
| Six-minute stability | No reload, freeze, or crash; no more than 10% FPS decline from the first minute to the final minute |
| Memory stability | No monotonic growth above 10% after warm-up through a six-minute match; record the actual memory metric available on each browser |
| Thermal stability | No thermal warning or sustained throttling during the six-minute pass; record device temperature/status if the OS exposes it |
| Gyro | Permission granted and denied paths both work; denial leaves touch controls usable |
| Interruptions | Background/foreground, orientation change, and pointer cancellation leave controls neutral and the match in the documented pause/resume state |

## Physical-device evidence

| Platform | Device / OS | Browser / version | Build commit | Six-minute run | FPS / frame-time trace | Memory / thermal | Controls / gyro | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Android | Not run | Chrome not run | — | — | — | — | — | NOT RUN |
| iOS | Not run | Safari not run | — | — | — | — | — | NOT RUN |

## Required device run

Use a real Android phone with Chrome and a real iPhone with Safari. Do not substitute desktop responsive mode.

1. Record phone model, OS version, browser version, screen dimensions, orientation, network, and tested commit.
2. Run a complete six-minute Strike. Capture a browser performance trace and record average FPS, p95/p99 frame time, frames over 50 ms, and memory at warm-up, minute 3, and minute 6.
3. Exercise left and right sticks simultaneously; fire while steering; lock a target; activate each ship's ability; adjust power; and test gyro permission grant and denial.
4. During input, release a pointer, trigger pointer cancellation if possible, background and restore the browser, and rotate the phone. Confirm controls return neutral and the match pauses/resumes as specified.
5. Repeat the full pass on Android Chrome and iOS Safari. Attach trace files or screen recordings and fill the evidence rows above.

For the complete tactile playtest script and ship-by-ship notes, see `PHONE-PLAYTEST-CHECKLIST.md`.
For the exact iOS Safari and Android Chrome staging smoke procedure, paired-device
profile-sync checks, and a fill-in evidence record, see
`PHYSICAL-DEVICE-SMOKE-TEST.md`.

## Current disposition

Automated control and interruption logic is covered by unit tests. Android Chrome and iOS Safari usability, frame rate, memory, thermal behavior, and the six-minute physical-device run remain **unverified**. Step 4 cannot be marked complete until both evidence rows are filled from real phones.
