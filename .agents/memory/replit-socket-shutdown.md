---
name: Replit socket shutdown checks
description: Compares application, managed-workflow, and Railway staging restarts for active WebSocket shutdown messages.
---

In the staging workspace on 2026-10-20, restarting the managed Wing Socket workflow closed an active client with code 1006 and no interruption notice. Running the compiled socket process directly and sending it SIGTERM delivered the interruption notice and close code 4002.

On 2026-10-26, an authorized in-place Railway staging socket restart closed two active WebSocket clients with code 1006 and no interruption notice. This remained true after an explicitly authorized staging-only direct-Node start-command deployment. The service recovered and a fresh room started; an earlier old-room token was rejected.

Local checks showed that the pnpm wrapper did not close sockets on SIGTERM, while direct Node did. A separate local integration with the staging gateway proxy and direct Node socket delivered the notice to both clients and forwarded close code 4002.

**Why:** The application and local proxy can deliver graceful shutdown, but Railway's in-place staging restart still produced abnormal closes after the direct-Node start command was applied. The exact platform boundary remains unconfirmed.

**How to apply:** Report direct-process, local-proxy, managed-workflow, and Railway restarts separately. Keep deployed restart notification failed until a real staging restart delivers the interruption notice and expected close code. Do not change Railway settings without user approval.
