# Shared client verification — 2026-10-21 UTC

## Source and environment

- Feature source: `8f7fc88e6d4d78d0dd3f19485b9047fd188afb27`.
- Final public-entry/graphics-recovery source: `a05fa095b1417bf3c2265eb222e3f81e5dcdd803`.
- Branch: `staging`; no promotion into `main`.
- Runtime: Node `v24.13.0`, pnpm `10.26.1`.
- Browser checks used the running **development preview**, not a published staging or production deployment.
- Full requirements/distribution mapping: `docs/shared-client-launch-plan.md`.
- Original supplied document is retained in `attached_assets/Pasted-Excellent-We-ll-treat-single-player-and-real-time-multi_1792544388282.txt`.

## Automated checks

At the feature source:

| Command | Result |
| --- | --- |
| `pnpm test` | PASS: API suite 50/50; game suite 14/14; zero failures |
| `pnpm run build` | PASS: workspace typecheck and all configured artifact builds, including API/socket bundles |

At the final UI-recovery source:

| Command | Result |
| --- | --- |
| `pnpm --filter @workspace/war-for-mars run typecheck` | PASS |
| `pnpm --filter @workspace/war-for-mars run build` | PASS |
| Focused browser recheck of the two discovered failures | PASS, with graphics limitations below |

The final recovery patch changed frontend routing/error presentation, not the tested socket resolver, gyro behavior, server origin policy or backend logic. The full suites were not rerun just to repeat unchanged checks.

New regression coverage includes:

- Same-origin HTTP/HTTPS socket URLs and artifact base paths.
- A separate secure backend retained across room replacement/reconnect resolution.
- Explicit rejection of mixed-content, malformed, credential-bearing and non-WebSocket overrides.
- Exact allowed origins, malformed origin configuration, missing/unlisted origins and local compatibility.
- Real ephemeral-port WebSocket handshake acceptance/rejection plus health-route availability.
- Missing gyro APIs and insecure-context fallback, alongside existing permission-denial, calibration and cleanup cases.

The Railway TOML parses and its single-region/single-process topology and health route were checked. Config fields were cross-checked with Railway's official config-as-code documentation. Fetching the public JSON schema returned HTTP 403; full remote-schema validation, deployment acceptance and live Railway operation are **not claimed**.

## Browser evidence

One fresh signed-out browser pass and a narrow recheck of its two findings:

| Check | Observed result |
| --- | --- |
| Direct `/play` with hosted auth/API requests blocked | Setup loads without sign-in; all eight ships selectable; no-account/no-save/no-rewards notice visible |
| Selection | Selecting Sentinel-G changes selection and launch label |
| Public home with hosted authentication blocked | Initially blank; fixed to render PublicLanding while auth loads; focused recheck confirms TRY SOLO FLIGHT reaches `/play` without private account UI |
| Practice and Strike entry | Initial HUDs showed `2:00` and `6:00`; this alone is **not** proof of working combat |
| WebGL | Browser reported unavailable/disabled context creation; 3D scene and simulation completion could not be verified |
| Graphics recovery | Fixed frozen-HUD behavior for the public trial; focused recheck confirms return to setup with a WebGL2 alert, preserved ship/mode controls and working Return home |
| Responsive layout | Setup reflows at 390×844; initial Strike HUD exposes touch controls; no obvious horizontal overflow |
| Guest progression boundary | No profile, strike-claim or economy requests/writes observed. Preview HMR WebSocket is not a gameplay connection |
| Gyro hardware/denial | Not browser-certified: the test environment reported the API as armed; automated denial/missing-API tests are separate evidence |

The blocked hosted-auth requests produced expected script-load errors during the fallback test. No accounts were created, backend player data changed, rewards granted, or GPU limitations hidden with a substitute simulation.

## Explicitly unverified

- Rendered combat, real two-minute completion, result/retry after a completed fight, and full six-minute stability in the browser test environment.
- Real Android Chrome/iPhone Safari, native builds, gyro hardware, FPS, frame-time consistency, RAM, install size and thermal behavior.
- Deployed Railway HTTPS/WSS, authenticated cross-host accounts/progression, real human ten-pilot play and public release readiness.
- Production database/schema, account recovery/isolation, backup/restore and rollback certification.
- APK/AAB/IPA/TestFlight/store submissions and an itch.io-compatible archive.

## Deployment safety

No Railway runtime/source/config was changed by this feature; no domain, database or production credentials were provisioned or copied. Replit development/private staging, test-gated promotion and the alpha end-on-server-restart rule remain in place.

**Status:** code/build and the public-entry/failure boundaries are verified to the extent above. Physical-device, successful graphics/gameplay, deployed-backend and production certification remain **PENDING**.
