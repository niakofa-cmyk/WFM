---
name: HTTP hostname security tests
description: Avoid false coverage when testing host-derived authentication and proxy trust.
---

Use a transport that demonstrably sends the intended Host header in hostname
security tests. Node's fetch transport may replace a supplied Host header;
setting that header in test source alone does not prove the server received it.

**Why:** Host-dependent auth and gateway tests initially exercised the local
transport hostname rather than the configured fixture hostname.

**How to apply:** Use node:http for local Host-header fixtures and assert the
host actually observed by the server. Keep credentials synthetic and never
read configured keys merely to build these tests.
