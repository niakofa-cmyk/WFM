#!/usr/bin/env bash
# Only for a clean CI emulator: no real accounts, credentials or sign-in attempts.
set -euo pipefail
out=generated-artifacts/android-startup
mkdir -p "$out"
apk=artifacts/war-for-mars/android/app/build/outputs/apk/staging/debug/app-staging-debug.apk
package=com.niakofa.wfm.staging

if ! adb shell pm path com.android.chrome | grep -q '^package:'; then
  echo "::error::Chrome is missing from the emulator; browser handoff was NOT tested."
  exit 1
fi
adb shell dumpsys package com.android.chrome | grep -m1 'versionName=' > "$out/browser-version.txt"
adb install -r "$apk"
adb shell am force-stop "$package"
adb logcat -c
adb shell am start -W -n "$package/com.niakofa.wfm.LauncherActivity" > "$out/launch.txt" 2>&1
cat "$out/launch.txt"
sleep 12
adb logcat -d -b crash > "$out/crash.txt"
adb shell dumpsys activity activities > "$out/activities.txt"
adb exec-out screencap -p > "$out/startup.png"
if grep -qE "Error:|Exception" "$out/launch.txt" ||
    grep -q "Process: $package" "$out/crash.txt"; then
  cat "$out/crash.txt"
  echo "::error::The installed WFM staging APK failed its native cold-start smoke test."
  exit 1
fi
if ! grep -E 'mResumedActivity|topResumedActivity' "$out/activities.txt" | grep -q 'com.android.chrome'; then
  echo "::error::No WFM crash was recorded, but Chrome did not become the foreground activity."
  exit 1
fi
adb shell am force-stop "$package"
adb logcat -c
adb shell am start -W -n "$package/com.niakofa.wfm.LauncherActivity" > "$out/relaunch.txt" 2>&1
sleep 8
adb logcat -d -b crash > "$out/relaunch-crash.txt"
if grep -qE "Error:|Exception" "$out/relaunch.txt" ||
    grep -q "Process: $package" "$out/relaunch-crash.txt"; then
  cat "$out/relaunch-crash.txt"
  echo "::error::The installed WFM staging APK crashed on relaunch."
  exit 1
fi
echo "Installed APK launched and handed off to Chrome without a WFM native crash."
echo "This does not certify sign-in, domain association, gameplay or rewards."
