# WAR FOR MARS — Physical-device staging smoke test

**Status: PARTIAL — Android Chrome is the approved physical-device scope; the recorded REVVL 8 run passes duration/frame-pacing only, with memory stability inconclusive. iPhone/Safari is not a release requirement.**

This checklist is for an authorized tester using the isolated Railway **staging**
environment. The owner approved Android Chrome as the required physical-device
scope; iPhone/Safari is out of scope and is not required for this gate. Desktop
responsive mode, browser emulation, and Playwright are supplemental only. Do not
sign in to Production, use Production credentials, or submit a Strike reward
claim during this smoke test.

## Safety and prerequisites

- Use one real Android phone running Chrome.
- Use only an approved existing **staging** test account. Do not create an account
  or change authentication settings for this test.
- Get the staging access code and any verification code through the approved
  secure channel. Do not put either code, account email, user ID, token, cookie,
  or authorization header in this record, screenshots, or traces.
- Verify the staging app, API, socket, and database are healthy before starting.
  Record the actual deployed source/deployment identifiers below; do not assume
  the baseline values remain current.
- Keep this run to profile loading, a reversible non-purchase preference change,
  and the local no-reward Solo Flight at `/play`. Signed-in WarApp Practice is
  server-authorized and may award credits on completion. Do not start signed-in
  Practice or Strike, call a claim endpoint manually, or use an online match as
  a substitute for this sync check.
- The known cross-session preference test used `STRAFE` and restored `ARC`.
  That server write may create unclaimed staging sortie records. Record whether
  the staging app created any; do not delete records directly from the database.

## Exact procedure

### 1. Record the build and devices

1. Confirm the target host is the protected staging host, not the public
   Production host.
2. Record the app/API/socket deployed commit and deployment IDs, along with the
   Railway staging health result.
3. Record each phone model, OS version, browser version, display dimensions,
   network type, and start time. Use physical-device details, not an emulated
   viewport.

### 2. Android — Chrome (required physical-device path)

1. Open the protected staging game URL directly in Chrome on the physical
   Android phone. Pass the staging access page using the separately supplied
   code.
2. Sign in with the approved staging test account. Complete only the challenge
   for this staging account. Confirm the profile loads; stop if the screen says
   `PLAYER PROFILE UNAVAILABLE`.
3. Record device/browser details and visible, non-identifying profile state.
   Do not record the email, user ID, authentication response body, or credits
   beyond the minimum needed to compare before/after.
4. Check portrait and landscape layout, safe areas, vertical scrolling, and
   return-to-portrait behavior. Note each screen actually checked.
5. Use `/play` for no-reward control checks. Confirm the local/no-reward notice,
   test both sticks, fire, ability, release/cancellation, and exit. Do not use
   signed-in Practice or Strike as a no-reward test.
6. Complete the six-minute local endurance sample only if needed for the
   performance gate. Record active game seconds, frame cadence, memory samples,
   and any OS thermal warning separately.
7. Briefly background/restore Chrome, rotate the phone, and confirm the
   documented pause/resume behavior with no stuck input. Sign out.

### 3. Cross-device profile sync (separate feature gate)

A paired physical-device profile-sync check is separate from the Android-only
device certification. If this feature gate is required, use two approved
physical Android Chrome devices; an iPhone is not required. Confirm the same
approved staging account on both, make a reversible preference change, observe
automatic update and restoration without manual refresh, then sign out. With
only one physical device, leave `profileSyncsAcrossDevices` **PENDING**;
independent browser contexts do not count as two physical devices.

### 4. Mobile layout and no-reward control check

Complete account/profile checks while signed in. For no-reward gameplay controls,
use the separate local Solo Flight route:

1. Confirm the title/menu, profile, and flight setup fit without horizontal
   scrolling or controls hidden by the notch, browser chrome, or bottom safe area.
2. Open `/play` and confirm the page identifies the flight as local and says it
   does not save progress or award rewards. This is separate from the signed-in
   WarApp flight flow.
   For a supplemental performance sample, enable **Record local performance**
   before launch and select the local **Strike** trial. Keep the page in the
   foreground; after any natural match result, tap **Continue performance
   sample** until the report confirms 360 active game seconds, then copy it.
   Active-play and result-screen frame cadence are separate. The report stays
   in the browser; frame intervals are estimates, not GPU timing. Browser heap
   is reported only when exposed, and temperature/throttling must be observed
   manually. This does not replace formal Strike performance certification.
   The virtual sticks start neutral at touch-down, respond to drag distance, and
   recenter on release/cancel. A held horizontal drag intentionally keeps
   turning; verify the axis returns to neutral when the thumb lifts.
3. Do not use signed-in WarApp Practice or Strike for a no-reward smoke test.
   Those modes start a server-authorized run; completing one submits its replay
   and may award credits.
4. In local Solo Flight, confirm the canvas initializes, both sticks respond,
   fire and ability controls work, and releasing/canceling a touch returns the
   control to neutral.
5. Rotate the device and briefly background/restore the browser. Confirm the
   documented pause/resume behavior and that controls are not left held. Do this
   as a separate local no-reward check after the uninterrupted six-minute sample.
6. Exit with `EXIT SOLO FLIGHT`. Confirm no server reward claim was submitted.
7. If local Solo Flight is unavailable or the page does not show the no-reward
   notice, skip this step and record it as not run. Do not substitute signed-in
   Practice or Strike.

## Existing owner-reported Android evidence (partial)

On 2026-10-27, the owner selected Android Chrome and identified the phone as a
REVVL 8, model TMRV085G, on T-Mobile, running Android 16. The owner confirmed
that this is the same phone previously described as Samsung and that `1.15.12`
is its phone model-build string. The later partial performance report records
Chrome 156.0.0.0 and capture time 2026-10-27 19:06:35.921 UTC; network type
remains unreported.

Two portrait screenshots were supplied: `attached_assets/1_1000000060_1793123563718.png`
shows the staging landing page, and `attached_assets/0_1000000061_1793123563687.png`
shows the local Solo Flight setup with its no-reward notice. Their image sizes
are 1080×2408 and 1080×2096 pixels respectively; those image dimensions are not
verified physical display dimensions. The screenshots do not show active flight
controls or a profile-sync result.

Earlier owner reports describe successful profile sign-in/sign-out, local
`/play` Solo Flight without credits, listed touch-control checks, and layout and
scrolling working after reload. This remains supplemental user-reported
evidence. The owner approved Android-only physical-device scope, so iPhone
Safari is **NOT REQUIRED**. The separate paired physical-device profile-sync
check has not been run and remains pending.

## Android-only run

Use this path for the required physical-device certification. It can establish
Android layout, controls, lifecycle, and performance evidence. It does not by
itself establish the separate cross-device profile-sync feature gate.

1. Record the real phone model, Android version, Chrome version, screen size,
   network type, and test time.
2. Confirm the host is the protected staging app. Use only an approved staging
   test account and obtain any staging access code through the secure channel.
   Do not use Production credentials or include codes in evidence.
3. Sign in and confirm the profile loads. Stop if `PLAYER PROFILE UNAVAILABLE`
   appears. Do not change profile preferences, purchase, launch a Strike, or
   claim a reward.
4. Check portrait and landscape layout, safe areas, and control reachability.
5. For no-reward input checks, open `/play` and confirm the local/no-reward
   notice. Verify both sticks, fire, ability, and touch release/cancellation.
   Do not use signed-in WarApp Practice or Strike for this check.
6. Briefly background and restore Chrome, then exit with `EXIT SOLO FLIGHT`.
   Confirm there is no stuck input. Sign out.
7. Attach sanitized screenshots or a short recording plus the device/browser
   details. Do not include account identifiers, email, access/verification
   codes, tokens, cookies, or browser storage.
8. Record the Android result as `PASS`, `PARTIAL`, or `FAIL` based only on the
   Android checks actually completed. Mark iPhone/Safari `NOT REQUIRED` under
   the approved scope. Keep paired physical-device profile sync `PENDING` until
   tested separately if that feature gate remains required.

## Evidence template

Fill this out after the run. Use tester initials or an approved internal alias,
not personal contact details.

### Run identity

| Field | Value |
| --- | --- |
| Date/time and timezone | |
| Tester alias | |
| Staging host confirmed | |
| App source commit / deployment ID | |
| API source commit / deployment ID | |
| Socket source commit / deployment ID | |
| Staging health / pending changes | |
| Staging account slot (`A`, no email/ID) | |
| Any unclaimed staging sortie created by preference changes | |

### Physical devices

| Platform | Model | OS | Browser/version | Screen size | Orientation(s) | Network |
| --- | --- | --- | --- | --- | --- | --- |
| Required: Android / Chrome | | | | | | |
| Optional second Android device for separate sync check | | | | | | |

### Observed results

| Check | Expected | Required Android Chrome | Optional second device | Evidence or sanitized notes |
| --- | --- | --- | --- | --- |
| Protected staging page and game load | Success on staging only | | | |
| Authenticated profile load | Successful; no unavailable-profile screen | | | |
| Layout, scrolling, safe areas, orientation | No clipped or unreachable controls | | | |
| Touch controls / release / cancellation | Responsive, neutral after release | | | |
| Background and foreground | Documented pause/resume; no stuck input | | | |
| Six-minute sample | Record duration, frame pacing, memory, and thermal observation | | | |
| Reward claim requests during local flight | None | | | |
| Sign-out | Completed on tested device | | | |
| Page errors / crashes | None, or fully described | | | |
| Paired profile sync (separate gate) | Auto-update and restoration without refresh | | | |

| Preference update (separate sync gate) | Started at | Visible on other device at | Elapsed seconds |
| --- | --- | --- | --- |
| `ARC` → `STRAFE` | | | |
| `STRAFE` → `ARC` | | | |

### Attachments and disposition

- Sanitized screenshot/video filenames (no codes, emails, IDs, or tokens):
- Browser trace/performance capture, if available and sanitized:
- Issues with exact reproduction steps:
- Result: `PASS` / `FAIL` / `PARTIAL` / `NOT RUN`
- Tester attestation that both devices were physical phones:
- Follow-up owner:

The Android physical-device gate remains **PENDING** until the Android checks
meet the documented targets and sanitized evidence is recorded. iPhone/Safari is
not required under the approved scope. Keep cross-device profile sync as a
separate gate if required. Do not mark either gate passed from desktop
automation or service health alone.
