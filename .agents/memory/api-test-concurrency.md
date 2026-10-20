---
name: API test concurrency
description: The API test suite has a timing-sensitive ten-client network impairment test.
---

Run API test files serially. Do not remove the `--test-concurrency=1` guard without checking the full workspace suite under normal workflow load.

**Why:** The seeded ten-client impairment test intermittently timed out while other API test files ran concurrently. It passed alone, and the full suite passed after API test file concurrency was limited to one.

**How to apply:** Preserve serial file execution in the API package test command. Re-run the complete workspace test suite after changing runner concurrency or expanding parallel server tests.
