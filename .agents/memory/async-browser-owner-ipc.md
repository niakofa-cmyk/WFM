---
name: Async browser-owner IPC
description: Reliability rules for private local sockets controlling retained browser sessions
---

When a shell command controls a long-lived browser owner through a Unix socket, preserve the socket's writable side until asynchronous Playwright work has returned. Enable half-open connections on the server and accepted sockets; otherwise a client FIN can discard the owner's later response. Call Playwright `waitForFunction` with its timeout in the options argument, not as the callback argument.

**Why:** An asynchronous browser-auth command lost its reply after the local socket closed early, making the outcome of a one-time verification challenge indeterminate.

**How to apply:** Use this for private retained-browser helpers. Add an async-response IPC self-test before handling credentials or verification codes, keep returned diagnostics sanitized, and never persist browser storage state.
