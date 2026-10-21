---
name: Replit socket shutdown checks
description: Distinguishes graceful application shutdown from managed development workflow restarts.
---

In the staging workspace on 2026-10-20, restarting the managed Wing Socket workflow closed an active client with code 1006 and no interruption notice. Running the compiled socket process directly and sending it SIGTERM delivered the interruption notice and close code 4002.

**Why:** The managed development workflow restart did not behave like a graceful application-process shutdown, so it is not reliable evidence of deployed restart behavior.

**How to apply:** Report direct Node SIGTERM and managed workflow restart as separate checks. Keep deployed restart behavior pending until it is verified on the invite-only staging deployment.
