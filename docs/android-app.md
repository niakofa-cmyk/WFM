# WFM Android app — staging-first

## What this is

An installable Android application using Google's Android Browser Helper
Trusted Web Activity (TWA). It reuses WFM's WebGL renderer, touch controls,
Clerk browser session, API contracts and authoritative multiplayer server.
It is not a second native game engine or an embedded WebView with an identity bridge.
Internet access and a TWA-capable browser (normally current Chrome) are required.
No offline campaign or offline progression is promised.

The first build is deliberately **staging-only**:

- Application ID: `com.niakofa.wfm.staging`.
- Launcher label: **WFM Staging**.
- Launch target: `https://wfm-app-staging-staging.up.railway.app/`.
- Minimum Android: 8.0 / API 26; compile and target SDK: 36.
- Version: `0.1.1-staging` / code `2`.
- Existing Railway app/API/socket/Postgres are reused; no database is created,
  migrated, reset or copied by the Android build.
- The staging access gate still applies, followed by normal Clerk authentication.
- No token or secret is embedded. Activity intent data cannot change the target.
- No new origins, CORS exceptions, auth provider, reward path or native permissions
  beyond internet access are introduced. Browser permissions remain browser-owned.

This does **not** certify Production, credit settlement, native OAuth callbacks,
store eligibility, or phone rendering. A successful APK compilation is not a
successful phone sign-in or live match.

## Build and obtain the APK

The `Android staging APK` GitHub Actions workflow builds on changes to the
Android source, associated checks or workflow, and also supports manual runs.
It runs Node configuration tests, Android JUnit tests, Android lint, and
`assembleStagingDebug`. It also installs and starts the actual APK on an
Android 13 emulator with Chrome, checks the crash log, and requires a foreground
browser handoff. That runtime check caught a missing Browser Helper manifest
component which compilation/lint and the no-browser lifecycle test did not catch.
Its artifact contains:

1. `wfm-staging.apk` — debug-signed test app, not a store release.
2. `apk-sha256.txt` — file integrity checksum.
3. `public-certificate.txt` — public signing-certificate information only.
4. `assetlinks-candidate.json` — candidate association for this exact APK.

Download the artifact from the matching GitHub Actions run. Only install APKs
from the owner's trusted repository/run. Android may require allowing installs
from the browser or file manager used to open this test APK. Do not disable
Play Protect. Uninstalling a test app may remove its app-local state; the
browser's sign-in/session and authoritative server records are separate.

Local alternative: install Android Studio, JDK 17, Android SDK 36 and Gradle 8.13,
then run from `artifacts/war-for-mars/android`:

```sh
gradle --no-daemon :app:testStagingDebugUnitTest :app:lintStagingDebug :app:assembleStagingDebug
```

No Gradle wrapper binary or signing material is stored in the repo.
Production release signing and Play App Signing are not configured.
GitHub debug signing keys are ephemeral: a later build can have a different
fingerprint and may require uninstalling the previous debug APK before installing.
Do not uninstall Chrome or clear browser storage to solve an APK signing mismatch.

## Domain verification is a separate owner-controlled step

A TWA requires the HTTPS website to associate its origin with the package and
APK's **actual signing-certificate** SHA-256 fingerprint. Without that verified
association the browser can show a Custom Tab with visible browser controls.
That safe fallback is expected, not evidence of authenticated fullscreen support.
Clerk pages on another origin may also show browser controls; do not add Clerk's
domain as trusted or claim ownership of it to hide them.

Review the generated candidate, then arrange an **explicitly authorized,
staging-only** change so the staging origin serves the statement at:

`https://wfm-app-staging-staging.up.railway.app/.well-known/assetlinks.json`

The response must be public HTTPS, JSON, without authentication or redirect.
This is a public association, not permission to expose the game/API or remove
the staging access gate. The current Android work does not publish the candidate
or change that gate. If statements already exist, merge the new reviewed
statement; do not replace other apps' associations.

The helper `node scripts/android-assetlinks.mjs <PUBLIC_SHA256_FINGERPRINT>`
accepts only a colon-separated public fingerprint and emits a staging-package
statement. Never pass a private key, keystore, password or session token.
No placeholder association is deployed. A release-signed APK will need its own
verified certificate; never use an ephemeral debug certificate for Production.

## Two-phone acceptance check

Use the REVVL and Samsung staging accounts already approved by the owner:

1. Install the same verified APK on each phone. Confirm **WFM Staging** and the
   staging host; note whether verified fullscreen or the safe browser fallback appears.
2. Unlock the existing staging gate and sign in normally. Confirm profile and
   Armory load, refresh/reopen retains the correct account, and sign-out hides
   private profile/ledger content. Do not paste credentials or tokens into reports.
3. Run **local no-reward Solo Flight** to check real WebGL rendering, audio after
   a gesture, touch sticks, fire and display layout. Check rotation and app switching.
4. Check the existing read-only phone profile report. Compare visible state,
   reopen the app, and verify ARC/STRAFE account preferences; gyro remains device-local.
5. Run the two-account Casual AI-fill/private test: same field, countdown,
   controls, disconnect/reconnect behavior, and no credit changes.
6. Competitive queue with two accounts must wait for ten distinct humans;
   cancellation must not grant credits. Do not call that positive reward proof.

Record Android/browser/app versions, exact build/run and observed results.
No automated build replaces these phone checks.

### Replacing the initial crashing APK

The initial `0.1.0-staging` launcher omitted Browser Helper's
`ManageDataLauncherActivity` declaration. Real Android threw an
`IllegalArgumentException` during startup when the helper tried to toggle that
component. The `0.1.1-staging` fix declares the component and its staging-only
manage-space URL; it does not change server access or authentication.

Install the replacement only from the passing runtime-checked build. If Android
rejects an in-place update because this debug build has a different certificate,
uninstall **WFM Staging only**, then install the new APK. That removes that
launcher's app-local state, not the server's player records. Do not clear Chrome
storage, remove accounts or uninstall Chrome.

## Production follow-up

Keep `com.niakofa.wfm` reserved for a separately reviewed Production variant.
Use the intended `https://niakofa.com/kids/wfm/` entry only after its current
authentication/profile routing and release gates pass. Configure release signing
securely, associate its real signing certificate on the actual public origin,
verify sign-in/profile/API/socket on devices, and then prepare a store release.
Neither this workflow nor the launcher deploys Railway or publishes to Google Play.

## Official implementation references

- https://developer.chrome.com/docs/android/trusted-web-activity/overview
- https://github.com/GoogleChrome/android-browser-helper/tree/main/demos/twa-basic
- https://developers.google.com/digital-asset-links/v1/getting-started
- https://developer.android.com/build/releases/past-releases/agp-8-13-0-release-notes
