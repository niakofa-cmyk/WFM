# WAR FOR MARS — Mobile Certification

**Status: NOT CERTIFIED — owner-reported REVVL 8 Android smoke checks are supplemental; full physical-device certification remains pending.**

This report separates automated control/lifecycle checks from Android Chrome and iOS Safari evidence. Desktop preview, browser emulation, and source inspection do not count as physical-phone performance results.

## Previously recorded build baseline

- Source commit: `7eae96dfb695f8658f452ca91e8d9c3b643bc2c3`
- Automated checks: workspace typecheck, all 40 automated tests, and production builds passed.
- Owner-reported Android smoke: 2026-10-27; REVVL 8 model TMRV085G, Android 16, T-Mobile; phone model-build `1.15.12`; Chrome version and tester alias not supplied
- Preview-only check: the public sign-up form rendered at 402×874 in the development preview. Clerk showed development keys; no account was created. This is not physical-device evidence.

The current endurance-sampling changes are being verified in the local WFM
workspace based on HEAD `330abb0` plus working-tree changes. They are available
only in the Replit development preview; they have not been deployed to Railway
staging or Production.

### Workspace verification

- The last full workspace pass before the duration-clarity patch passed
  typecheck, 133 tests (scripts 17, API 73, game 43), configured workspace
  builds, and browser E2E 8/8.
- The duration-clarity patch then passed focused simulation/parity tests 10/10,
  War for Mars typecheck, the War for Mars production build, and its focused UI
  E2E 1/1.
- These are local checks, not physical-device or Railway staging evidence. The
  updated 360-active-second sample still needs to be run on the REVVL 8.

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

For a six-minute sample, select local **Strike**, enable the recorder, and keep
the page in the foreground. If a natural result occurs early, tap **Continue
performance sample** to begin another local no-reward round. Capture stops at
360 cumulative active game seconds. Active-play frames, result-screen frames,
and wall time outside sampled frames are reported separately. The sample stays
in the browser and does not submit a reward.

This is supplemental: RAF cadence is not GPU timing, and a local no-reward run
does not satisfy the formal Strike certification below. The endurance path is
in the current Replit workspace and has not been physically retested or deployed
to Railway staging or Production.

The earlier REVVL 8 attempt stopped before the six-minute target because the
left touch stick appeared to steer right and circle the ship. The tester later
confirmed neutral touch-down, deliberate drag, and release-to-center worked in a
short local Practice retest. The subsequent physical performance report was a
partial 221.7-second run on an earlier preview build; the updated endurance
scenario still needs a full physical run.

The user then reported that a short local Practice retest on the REVVL 8 behaved
as expected: touch stayed neutral, deliberate drag worked, and release recentered
the stick. This is user-reported control evidence only; the six-minute Strike
target remains **PENDING**.

### Physical Android sample — partial

The user reported a local Solo Flight sample on the REVVL 8 (TMRV085G,
Android 16), Chrome 156.0.0.0, in the Replit development preview. Captured
2026-10-27 19:06:35.921 UTC in portrait: screen 360×803 CSS px, viewport
360×754 CSS px, DPR 3. Reported frame cadence was 80.2 average FPS, p95 17 ms,
p99 25 ms, one interval over 50 ms out of 18,298 (about 0.0055%), and zero
intervals over 250 ms. The first game minute averaged 80.7 FPS with p95/p99
17 ms. Heap readings stayed at 19.6 MiB used / 37.8 MiB total over five samples.
No background/restore transitions were recorded. The earlier report noted no
heat or throttling warnings.

This is **partial**, not six-minute evidence: the report recorded 221.7 game
seconds and 228 wall seconds, while the selected Strike target is 360 game
seconds. It contained no final-minute frames. The user marked the match
complete and later confirmed the Debrief appeared naturally before the timer.
The report does not identify the specific outcome reason. Frame metrics are
browser requestAnimationFrame cadence, not GPU render timing. This earlier
sample used a Replit preview based on workspace commit
`e4980639f3442329bd7b441368740e893d481cfb` plus uncommitted touch-control
changes; it was not a Railway deployment. A later full sample is recorded
below.

The report format includes the selected trial target and a `targetReached`
flag, with an on-screen warning when a run ends early. The local endurance
sample is one no-reward session: it suppresses mission and integrity endings
only for that session and stops at the 360-second cap. Normal Strike retains
its early mission endings. Result-screen frames are reported separately.

A separate user-supplied partial summary recorded a match ending at 170.8
active game seconds, followed by 4.5 seconds of post-match frames. That earlier
run is consistent with a normal early terminal match, not a frame-rate or
visibility stall. It did not include a terminal reason, raw report, capture
environment, or device/browser metadata, so it remains historical diagnostic
evidence only.

The later report captured at `2026-10-27T21:20:42.434Z` reached the full
360 active game seconds in one run (`targetReached: true`, one run started and
completed). The report identifies the environment as the Replit Development
preview, explicitly not Railway staging or Production. It recorded 28,705
active-play frames at 78.1 average FPS, with 83.6 FPS in the first game minute
and 77.5 FPS in the final minute (about a 7.3% decline). Frame pacing was
p95 17 ms / p99 25 ms; 2 frames exceeded 50 ms (0.007%), with no gaps above
250 ms. Reported used heap was 15.6 MiB at start and 19.8 MiB at 360 seconds,
with samples fluctuating between 18.1 and 20.1 MiB after the first minute.
No background/restore transitions were recorded. Browser APIs did not expose
thermal status, and this report included no separate thermal observation.
These results pass the numeric performance targets for this single
user-reported Android sample; they do not certify controls, gyro, interruption
recovery, thermal behavior, iOS Safari, staging, or Production. Overall physical
device certification remains **PENDING**.

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
| Android | REVVL 8 (TMRV085G), Android 16; phone model-build `1.15.12` | Chrome 156.0.0.0 | Replit Development preview at commit `97ead20` (not Railway staging/Production) | 360/360 active game seconds; one run started/completed; captured `2026-10-27T21:20:42.434Z` | 78.1 average FPS; first/final minute 83.6/77.5 FPS; p95 17 ms; p99 25 ms; 2/28,705 frames over 50 ms (0.007%); no >250 ms gaps | Used heap 15.6 MiB at start, 19.8 MiB at 360 sec; no thermal status exposed and no separate observation in this report | Earlier short Practice check: neutral touch, drag, and release recenter confirmed; controls/gyro/lifecycle not measured in this sample | PASS — endurance performance sample only; user-reported |
| iOS | Not run | Safari not run | — | — | — | — | — | NOT RUN |

The completed Android sample does not change the overall device-certification
gate: full touch-control, gyro, interruption/restore, and iOS Safari checks
remain outstanding.

## Required device run

Use a real Android phone with Chrome and a real iPhone with Safari. Do not substitute desktop responsive mode.

1. Record phone model, OS version, browser version, screen dimensions, orientation, network, and tested commit.
2. With Strike selected, enable **Run one local endurance sample**. This is a single browser-only no-reward run; objectives and integrity depletion are suppressed only for this sample. Record active-play FPS, p95/p99 frame time, frames over 50 ms, final-minute metrics, and memory at warm-up, minute 3, and minute 6. Result-screen and transition time remain separate.
3. Exercise left and right sticks simultaneously; fire while steering; lock a target; activate each ship's ability; adjust power; and test gyro permission grant and denial.
4. During input, release a pointer, trigger pointer cancellation if possible, background and restore the browser, and rotate the phone. Confirm controls return neutral and the match pauses/resumes as specified.
5. Repeat the full pass on Android Chrome and iOS Safari. Attach trace files or screen recordings and fill the evidence rows above.

For the complete tactile playtest script and ship-by-ship notes, see `PHONE-PLAYTEST-CHECKLIST.md`.
For the exact iOS Safari and Android Chrome staging smoke procedure, paired-device
profile-sync checks, and a fill-in evidence record, see
`PHYSICAL-DEVICE-SMOKE-TEST.md`.

## Current disposition

Automated control and interruption logic is covered by unit tests. The
owner-reported REVVL 8 Android check is supplemental. The earlier physical sample
captured partial performance metrics but ended naturally at 221.7 of 360 active
game seconds and predates the current endurance flow. A full physical sample
using the new flow, including final-minute evidence, remains **PENDING**. The
owner confirmed Android 16 and phone model-build `1.15.12`; Chrome 156.0.0.0 is
present in the supplied report. No iPhone is available to the owner, so iOS
Safari and paired-device profile sync were not run. Thermal state is not
available through standard browser APIs. Full six-minute physical certification
remains unverified.
