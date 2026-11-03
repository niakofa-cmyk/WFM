---
name: Android runtime verification
description: APK startup requires a real Android/browser test beyond compilation and JVM lifecycle tests.
---

Require installation and cold startup of the APK on Android with a browser before
calling a WFM Android build ready for phone testing. Compilation, lint and
Robolectric lifecycle tests alone are insufficient.

**Why:** real Android rejected a missing browser-helper component during startup,
while the JVM package-manager shadow accepted the component toggle and the
no-browser lifecycle tests passed. The installed app crashed before sign-in even
though Railway was healthy.

**How to apply:** retain an installed-APK startup gate with Chrome, native crash
log inspection and foreground browser-handoff checks. Test required component
registration explicitly as well. Keep this evidence separate from physical
phone sign-in, fullscreen domain association, gameplay and reward settlement.
