---
name: Async browser-owner IPC
description: Reliability rules for private local sockets controlling retained browser sessions
---

When a shell command controls a long-lived browser owner through a Unix socket, preserve the socket's writable side until asynchronous Playwright work has returned. Enable half-open connections on the server and accepted sockets; otherwise a client FIN can discard the owner's later response. Call Playwright `waitForFunction` with its timeout in the options argument, not as the callback argument.

**Why:** An asynchronous browser-auth command lost its reply after the local socket closed early, making the outcome of a one-time verification challenge indeterminate.

**How to apply:** Use this for private retained-browser helpers. Add an async-response IPC self-test before handling credentials or verification codes, keep returned diagnostics sanitized, and never persist browser storage state.

Hot-loading a helper module does not replace callbacks already attached to
Playwright page/WebSocket events.

**Why:** an updated test observer expected heading fields, but its retained
listener still executed the earlier summarizer and never populated them.

**How to apply:** use a stable owner-side dispatcher or explicitly replace only
test-owned observer listeners before expecting new fields. A normal reload in
the same authenticated context may rejoin the socket; it is not a reason to
create another browser, export state or repeat sign-in.
