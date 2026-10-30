---
name: API test concurrency
description: The API test suite has a timing-sensitive ten-client network impairment test.
---

Run API test files serially. Do not remove the `--test-concurrency=1` guard without checking the full workspace suite under normal workflow load.

**Why:** The seeded ten-client impairment test intermittently timed out while other API test files ran concurrently. It passed alone, and the full suite passed after API test file concurrency was limited to one.

**How to apply:** Preserve serial file execution in the API package test command. Re-run the complete workspace test suite after changing runner concurrency or expanding parallel server tests.

For live WebSocket room checks, send the first join before the others and identify the host from the server-assigned seat/state rather than a client-array index.

**Why:** Connection and message arrival order can differ from the test harness's array order; the first join received by the server becomes host. A parallel staging join made a host-only assertion nondeterministic, while ordered joins removed the ambiguity.

**How to apply:** Keep live room setup deterministic when testing host-only actions, readiness gates, or match start.
