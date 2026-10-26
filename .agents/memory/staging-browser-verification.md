---
name: Staging browser verification
description: Protect credentials and distinguish real browser request behavior from synthetic HTTP tests.
---

Do not transfer test credentials through tool messages, URLs, public relay
routes, traces, or stored browser-state files when a remote browser notebook
cannot access project secrets. Use a project-side browser process that reads
the approved secret names itself. Keep long flights in a managed background
process rather than an ordinary detached process or a foreground shell call.

**Why:** the remote browser notebook does not share project environment
variables, and a six-minute Strike exceeds the foreground shell time limit.

**How to apply:** retain credentials and sessions only in the driver's memory,
emit sanitized status fields, and use the existing testing agent to evaluate
that driver's evidence rather than starting another tester.

Synthetic HTTP tests that explicitly supply Origin do not prove browser form
submissions will supply the same Origin under the page's privacy headers.

**Why:** a real browser rejected the staging form despite passing HTTP probes:
the page's no-referrer policy made its form POST carry an opaque Origin.

**How to apply:** verify actual browser-supplied request metadata for changes
to form/privacy headers; never resolve such failures by accepting null or
untrusted origins.

Authentication tests must confirm an active session before forcing navigation
away from a sign-in flow. A submitted form or changed URL is not sign-in proof.

**Why:** navigating after a fixed post-submit delay can interrupt session or
redirect completion and leave an inconclusive signed-out page without exposing
whether authentication succeeded, failed, or required another step.

**How to apply:** wait for a confirmed session or a specific safe error/challenge,
then require an authenticated profile response before starting rewarded play.
