---
name: Replit socket shutdown checks
description: Compares application, managed-workflow, and Railway staging restarts for active WebSocket shutdown messages.
---

In the staging workspace on 2026-10-20, restarting the managed Wing Socket workflow closed an active client with code 1006 and no interruption notice. Running the compiled socket process directly and sending it SIGTERM delivered the interruption notice and close code 4002.

On 2026-10-26, an authorized in-place Railway staging socket restart also closed two active WebSocket clients with code 1006 and no interruption notice. The service recovered; the old reconnect token was rejected and a fresh room started.

An isolated local comparison found the same signal boundary: the Railway-style pnpm start command did not close active sockets after SIGTERM was sent to pnpm, while launching the socket directly with Node delivered the notice and close code 4002.

**Why:** Managed workflow and Railway service restarts did not deliver the application's graceful shutdown notice, while direct Node did. The pnpm launch wrapper is a likely signal-forwarding boundary; confirming or changing the Railway start command requires explicit authorization.

**How to apply:** Report direct-process, managed-workflow, and Railway restarts separately. Treat deployed restart notification as failed until a real staging restart delivers the interruption notice and expected close code. Do not change the Railway start command without user approval.
