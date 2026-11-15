---
name: Graphics verification boundaries
description: Distinguish visible combat HUD from an initialized WebGL simulation in browser evidence.
---

A visible combat HUD or starting timer is not proof that the 3D scene initialized or that a match can complete. A headless test browser may have WebGL unavailable.

**Why:** a preview browser displayed Practice/Strike HUDs while context creation failed and no combat scene ran. This is an environment blocker, not a successful gameplay or mobile-performance certification.

**How to apply:** verify actual scene rendering, an advancing simulation and real outcomes before claiming combat completion. Record graphics blockers explicitly, check clear failure recovery, and keep physical-phone certification separate.

The remote test browser can report graphics disabled while the project's
packaged browser successfully runs the same scene with software WebGL.

**Why:** the same public flight failed context creation remotely but rendered
and accepted controls with the project-side software renderer. A bare downloaded
browser also failed before launch on missing system libraries.

**How to apply:** distinguish browser-runtime provisioning from app build
failures, use the supported project-side browser for software-rendering evidence,
and never equate software-rendering success with physical GPU performance.

Visible flight-stick response and changing range do not establish that a
destination's docking gate was reached; verify range, relative speed and
alignment against the active build's thresholds and test the complete
dock/activity/return loop.

**Why:** an earlier software-rendered Cinder approach ended near the station but
outside its then-current gate. A later software-rendered run passed docking,
training return and undock after the approach envelope was adjusted.

**How to apply:** report scene, control, gate and post-dock activity evidence as
separate checkpoints; continue testing from measured telemetry rather than
assuming a responsive HUD proves the full travel loop. Keep software-browser
success separate from physical-device certification.

Software-WebGL launch flags alone may not enable a remote browser whose
graphics vendor/renderer is reported as `Disabled`.

**Why:** genuine Chromium SwiftShader flags still failed in that browser while
the separate preview capture rendered the scene. Changing app physics or adding
a fake renderer would not resolve the evidence gap.

**How to apply:** stop repeated flag-only retries after the explicit disabled
graphics result. Use a verified project-side browser or physical device for the
interactive journey and report the remote limitation separately.

Isolated browser component fixtures must share the application's resolved
provider module, including Vite's dependency-version query string.

**Why:** importing a separate unversioned Wouter module creates another context;
links then appear to ignore the fixture's base even when application routing is
correct.

**How to apply:** use the provider import URL from the transformed application
module when mounting a fixture. Distinguish fixture-context errors from real
route failures before changing production navigation.
