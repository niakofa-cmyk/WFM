# WAR FOR MARS — Physical-device staging smoke test

**Status: PENDING — no real iPhone or Android phone was exercised for this record.**

This checklist is for an authorized tester using the isolated Railway **staging**
environment. Desktop responsive mode, browser emulation, and Playwright are
supplemental only. Do not sign in to Production, use Production credentials, or
submit a Strike reward claim during this smoke test.

## Safety and prerequisites

- Use one real iPhone running Safari and one real Android phone running Chrome.
- Use only an approved existing **staging** test account. Do not create an account
  or change authentication settings for this test.
- Get the staging access code and any verification code through the approved
  secure channel. Do not put either code, account email, user ID, token, cookie,
  or authorization header in this record, screenshots, or traces.
- Verify the staging app, API, socket, and database are healthy before starting.
  Record the actual deployed source/deployment identifiers below; do not assume
  the baseline values remain current.
- Keep this run to profile loading, a reversible non-purchase preference change,
  and the app's no-reward practice flow. Do not start a rewarded Strike, call a
  claim endpoint manually, or use an online match as a substitute for this sync
  check.
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

### 2. iPhone — Safari

1. Open the staging game URL directly in Safari (not an embedded browser or
   home-screen wrapper).
2. Pass the staging access page using the separately supplied code. Confirm the
   game loads and that Safari shows no horizontal page overflow.
3. Sign in with the approved staging test account. Complete only the challenge
   for this staging account. Confirm the player profile loads successfully;
   stop if the screen says `PLAYER PROFILE UNAVAILABLE`.
4. Record the visible starting credits and selected ship/technology as
   non-identifying values. Do not record the email, user ID, or authentication
   response body.
5. In profile settings, change the technology from `ARC` to `STRAFE`. Do not
   purchase, refit, launch a Strike, or claim a reward.
6. Rotate portrait to landscape and back. Confirm the visible controls and text
   remain on-screen and there is no stuck touch input.
7. Leave the page open and continue to step 3 on Android without refreshing.

### 3. Android — Chrome and paired-device synchronization

1. Open the same protected staging game URL in Chrome on the physical Android
   phone. Pass the staging access page with the separately supplied code.
2. Sign in to the **same approved staging account** as on iPhone. Confirm its
   profile loads and initially shows the prior `ARC` selection.
3. Without refreshing or manually requesting the profile, wait up to **35
   seconds** for Android Chrome to show `STRAFE`.
4. Record the time from the accepted iPhone selection to the Android UI update.
   The earlier browser-only comparison measured about 26.8 seconds; that is a
   reference, not physical-device evidence or a substitute pass.
5. On iPhone, restore the selection to `ARC`. Again, wait up to 35 seconds for
   Android Chrome to show the restored value without refreshing.
6. Refresh both phones once. Confirm both profiles load and show the same
   restored selection and unchanged credits.
7. Sign out on both phones. Confirm each device returns to the signed-out state.
   Do not capture or retain browser storage or authentication state.

### 4. Mobile layout and no-reward control check

Complete account/profile checks while signed in. For no-reward gameplay controls,
use the separate local Solo Flight route:

1. Confirm the title/menu, profile, and flight setup fit without horizontal
   scrolling or controls hidden by the notch, browser chrome, or bottom safe area.
2. Open `/play` and confirm the page identifies the flight as local and says it
   does not save progress or award rewards. This is separate from the signed-in
   WarApp flight flow.
3. Do not use signed-in WarApp Practice or Strike for a no-reward smoke test.
   Those modes start a server-authorized run; completing one submits its replay
   and may award credits.
4. In local Solo Flight, confirm the canvas initializes, both sticks respond,
   fire and ability controls work, and releasing/canceling a touch returns the
   control to neutral.
5. Rotate the device and briefly background/restore the browser. Confirm the
   documented pause/resume behavior and that controls are not left held.
6. Exit with `EXIT SOLO FLIGHT`. Confirm no server reward claim was submitted.
7. If local Solo Flight is unavailable or the page does not show the no-reward
   notice, skip this step and record it as not run. Do not substitute signed-in
   Practice or Strike.

## Android-only run (partial evidence only)

Use this path when an Android Chrome tester is available but the paired iPhone
Safari tester is not. It can document Android layout, controls, and practice
flight behavior; it cannot pass the cross-device profile-sync or full physical
device gate.

1. Record the real phone model, Android version, Chrome version, screen size,
   network type, and test time.
2. Confirm the host is the protected staging app. Use only an approved staging
   test account and obtain any staging access code through the secure channel.
   Do not use Production credentials or include codes in evidence.
3. Sign in and confirm the profile loads. Stop if `PLAYER PROFILE UNAVAILABLE`
   appears. Do not change profile preferences, purchase, launch a Strike, or
   claim a reward.
4. Check portrait and landscape layout, safe areas, and control reachability.
   If the no-reward Practice mode is available, verify both sticks, fire,
   ability, and touch release/cancellation. Do not continue if a flow would
   launch a rewarded Strike.
5. Briefly background and restore Chrome, then exit Practice normally. Confirm
   there is no stuck input or reward claim request. Sign out.
6. Attach sanitized screenshots or a short recording plus the device/browser
   details. Do not include account identifiers, email, access/verification
   codes, tokens, cookies, or browser storage.
7. Record the result as `PARTIAL`. The iPhone Safari and paired cross-device
   synchronization rows remain `NOT RUN` and the full physical-device gate
   remains `PENDING`.

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
| iPhone / Safari | | | | | | |
| Android / Chrome | | | | | | |

### Observed results

| Check | Expected | iPhone Safari | Android Chrome | Evidence or sanitized notes |
| --- | --- | --- | --- | --- |
| Protected staging page and game load | Success on staging only | | | |
| Authenticated profile load | Successful; no unavailable-profile screen | | | |
| Starting selection / credits | Same account baseline | | | |
| `ARC` → `STRAFE` synchronization | Android updates without refresh within 35 seconds | | | |
| `STRAFE` → `ARC` restoration | Android updates without refresh within 35 seconds | | | |
| Refresh/session continuity | Both show restored state | | | |
| Layout, safe areas, orientation | No clipped or unreachable controls | | | |
| Touch controls / release / cancellation | Responsive, neutral after release | | | |
| Background and foreground | Documented pause/resume; no stuck input | | | |
| Reward claim requests | None | | | |
| Sign-out | Completed on both devices | | | |
| Page errors / crashes | None, or fully described | | | |

| Preference update | Started at | Visible on other device at | Elapsed seconds |
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

The physical-device gate remains **PENDING** until an authorized tester completes
the required checks on actual iPhone Safari and Android Chrome devices and
attaches sanitized evidence. Do not mark it passed from this template, desktop
automation, or a staging service health result alone.
