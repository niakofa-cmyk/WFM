---
name: Replit socket shutdown checks
description: Compares application, managed-workflow, and Railway staging restarts for active WebSocket shutdown messages.
---

In the staging workspace on 2026-10-20, restarting the managed Wing Socket workflow closed an active client with code 1006 and no interruption notice. Running the compiled socket process directly and sending it SIGTERM delivered the interruption notice and close code 4002.

On 2026-10-26, a two-client raw-protocol Railway staging restart closed both clients with code 1006 and no interruption notice. Later that day, an authenticated one-pilot browser match displayed the server-restart/no-rewards message after another staging restart; that browser run did not capture its close code. The service recovered.

Local checks showed that the pnpm wrapper did not close sockets on SIGTERM, while direct Node did. A separate local integration with the staging gateway proxy and direct Node socket delivered the notice to both clients and forwarded close code 4002.

**Why:** The raw multi-client and authenticated browser results differ. A single visible UI message does not establish delivery to every pilot or explain the prior abnormal closes.

**How to apply:** Report direct-process, local-proxy, managed-workflow, raw multi-client, and authenticated browser results separately. Keep the all-player release check partial until a multi-client browser run records notice delivery and close behavior for each pilot. Do not change Railway settings without user approval.
