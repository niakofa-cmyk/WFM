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
