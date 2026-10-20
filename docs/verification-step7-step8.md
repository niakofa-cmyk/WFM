# Verification report: server-owned progression and campaign

**Tested source commit:** `4e3db64a1dee176a035b9b759dbdee9487b2017b`  
**Date:** 2026-10-20

## Results

| Check | Result |
| --- | --- |
| `pnpm -w run typecheck` | Pass |
| `pnpm -w run test` | Pass — 24 API/server tests and 6 game/client tests |
| `pnpm -w run build` | Pass — workspace builds, including game and API/socket bundles |
| `git diff --check` | Pass |
| Development progression schema push | Pass |
| API health endpoint | HTTP 200 |
| Unauthenticated profile request | HTTP 401 |

The API test suite includes exact-once reward claims, rejected forged progression fields, incomplete replay rejection, isolated multiplayer rooms, reconnect behavior, and ten concurrent clients completing a match. The campaign tests cover the four-sortie unlock chain, recovered intel, and technology unlocks. Client storage tests verify that browser storage cannot restore credits or campaign progression.

The game build currently emits a non-blocking Vite warning that its JavaScript bundle is larger than 500 kB.

## Preview evidence

- [Mobile-width public landing page](evidence/landing-mobile.jpg)
- [Sign-in page](evidence/sign-in-desktop.jpg)

## Verification limits

- Replay inputs still come from the client. The server owns the seed and match configuration, re-simulates the submitted inputs, and calculates and records rewards, but this is not a live authoritative multiplayer simulation or a complete anti-cheat system.
- The preview browser is unauthenticated, so a signed-in browser session and account flow were not exercised end to end. Authentication rejection and the progression service were tested separately.
- The development database schema was pushed and tested. Production schema application and production Clerk configuration have not been verified.
- Screenshots are browser-preview checks, not physical iOS or Android device tests.
