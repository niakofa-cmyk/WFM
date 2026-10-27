# WAR FOR MARS — Mobile Certification

**Status: NOT CERTIFIED — owner-reported REVVL 8 Android smoke checks are supplemental; full physical-device certification remains pending.**

This report separates automated control/lifecycle checks from Android Chrome and iOS Safari evidence. Desktop preview, browser emulation, and source inspection do not count as physical-phone performance results.

## Build under test

- Source commit: `7eae96dfb695f8658f452ca91e8d9c3b643bc2c3`
- Automated checks: workspace typecheck, all 40 automated tests, and production builds passed.
- Owner-reported Android smoke: 2026-10-27; REVVL 8 model TMRV085G, Android 16, T-Mobile; phone model-build `1.15.12`; Chrome version and tester alias not supplied
- Preview-only check: the public sign-up form rendered at 402×874 in the development preview. Clerk showed development keys; no account was created. This is not physical-device evidence.

## Automated coverage and code checks

The automated mobile-control tests cover:

- Combining both touch sticks with fire, lock, ability, evade, power selection, and gyro aim.
- Clearing held keys, sticks, fire, and latched actions through the reset helper used by focus-loss handling.
- Gyro permission denial while retaining touch steering.
- Gyro permission grant, calibration, orientation reset, and listener cleanup when disabled.

The game also clears held input and pauses the local simulation when the document is hidden, resizes the arena after device orientation and visual-viewport changes, and resets a stick on pointer capture loss. These are code-level checks; they do not prove browser behavior on a physical device.

## Supplemental local no-reward sampler

The `/play` setup has an opt-in **Record local performance** control. On local
Solo Flight only, it summarizes requestAnimationFrame intervals, first/final
game-minute cadence, background/restore transitions, and JavaScript heap
readings when the browser exposes them. The capture remains in memory on that
device and is not uploaded. Thermal data is not available through the standard
browser API and must be observed manually.

For a six-minute sample, select the local **Strike** trial and keep the page in
the foreground until it completes. The result appears after tapping **Debrief**.
This is supplemental: RAF cadence is not GPU timing, and a local no-reward run
does not satisfy the formal full-Strike certification below. No physical sample
has been run with this recorder yet. The current sampler is available only in
the Replit development preview, based on workspace HEAD
`e4980639f3442329bd7b441368740e893d481cfb` plus uncommitted touch-control fixes; it
has not been deployed to Railway staging or Production.

The REVVL 8 user-reported attempt was stopped before the six-minute run because
the left touch stick appeared to steer right and circle the ship. No performance
report was produced, so the physical performance sample remains **PENDING**.
Touch-stick input now starts neutral at pointer-down, applies a small radial
dead zone, follows drag relative to the touch start, and resets on release or
cancel. Unit and browser regression checks pass; the physical behavior must
still be retested before resuming the six-minute run.

The user then reported that a short local Practice retest on the REVVL 8 behaved
as expected: touch stayed neutral, deliberate drag worked, and release recentered
the stick. This is user-reported control evidence only; the six-minute Strike
sample and its performance metrics remain **PENDING**.

### Physical Android sample — partial

The user reported a local Solo Flight sample on the REVVL 8 (TMRV085G,
Android 16), Chrome 156.0.0.0, in the Replit development preview. Captured
2026-10-27 19:06:35.921 UTC in portrait: screen 360×803 CSS px, viewport
360×754 CSS px, DPR 3. Reported frame cadence was 80.2 average FPS, p95 17 ms,
p99 25 ms, one interval over 50 ms out of 18,298 (about 0.0055%), and zero
intervals over 250 ms. The first game minute averaged 80.7 FPS with p95/p99
17 ms. Heap readings stayed at 19.6 MiB used / 37.8 MiB total over five samples.
No background/restore transitions were recorded, and the user did not notice
heat or throttling warnings.

This is **partial**, not six-minute evidence: the report recorded 221.7 game
seconds and 228 wall seconds, while the selected Strike target is 360 game
seconds. It contained no final-minute frames. The user marked the match
complete, but the report does not identify whether it ended naturally or was
exited early. Frame metrics are browser requestAnimationFrame cadence, not GPU
render timing. The tested build was the Replit preview based on workspace HEAD
`e4980639f3442329bd7b441368740e893d481cfb` plus uncommitted touch-control
changes; it was not a Railway deployment. Full six-minute performance remains
**PENDING**.

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
| Android | REVVL 8 (TMRV085G), Android 16; phone model-build `1.15.12` | Chrome selected; version not supplied | Build commit not captured | Six-minute run not reported | Not captured | Not captured | Owner reports local Solo Flight controls and touch lifecycle worked | PARTIAL — user-reported |
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

Automated control and interruption logic is covered by unit tests. The
owner-reported REVVL 8 Android check is supplemental. The owner confirmed it is
the same device previously described as Samsung, running Android 16; `1.15.12`
is the phone model-build string. The exact Chrome version and performance
traces required by this certification are absent. No iPhone is available to
the owner, so iOS Safari and paired-device profile sync were not run. Android
Chrome and iOS Safari usability, frame rate, memory, thermal behavior, and the
six-minute physical-device run remain **unverified**. Step 4 cannot be marked
complete until both evidence rows are completed from real phones.
