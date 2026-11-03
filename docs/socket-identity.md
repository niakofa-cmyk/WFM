# Socket identity and recovery integration

## Scope and three review steps
Continue `seele/combat-foundation` using the existing React/Vite/Three.js, Clerk and authoritative planar WebSocket service. This continuation implements (1) verified Clerk session identity at the existing socket join boundary with protocol negotiation, (2) account-owned seat recovery and client token refresh on every reconnect, and (3) focused authentication, ownership and synthetic networking regressions. It does not expose the orbital harness prematurely or substitute a new networking/storage provider. No push, PR, database migration or Railway release.

## Source findings
HTTP routes already use Clerk; the standalone socket service does not. It generates a UUID per connection and permits token-only reconnect takeover. Socket authentication must complete before creating a room or accepting a seat. Credentials travel only in the first join frame, never in URLs, snapshots, diagnostics or persistence. Session claims are verified by the existing Clerk SDK; expired or pending sessions and unauthorized origins fail closed. Existing weapon/damage simulation remains server-owned.

## Asset Preparation — complete
Inspected `docs/combat-lab.md` inventory and `src/game/orbital-visuals.ts`. No rendering, models, materials, textures, animation, audio or HUD changes are required. Existing procedural fighters, Mars/station/asteroids, synthesized audio and scoped system-font interface are sufficient. No new asset requests, remote media, licenses or unresolved media dependencies. Runtime and relative resource checks remain required at final validation.

## Intended review gates
Authentication tests use locally generated RSA-signed **synthetic** session claims verified through the real Clerk SDK, not real account login certification. Test missing/forged/expired/wrong-origin/pending tokens and protocol rejection before room allocation; account ownership, stale token reuse, takeover input fencing, disconnect expiration and session expiration. Existing synthetic ten-client/loss/jitter/restart tests remain explicit transport fixtures. Run focused tests, typecheck, server/client builds, canonical Preview entry regressions, actual browser combat smoke check and mandated Preview publication. Record actual results and changed-file inventory after completion.

## Implemented review behavior
- Production socket entry now requires a Clerk JWT public key or existing backend secret, plus an explicit list of authorized frontend origins. The existing Clerk SDK verifies signatures, token dates and authorized party; additional checks require user/session claims and reject pending sessions. Browser Origin must match the signed `azp`. No anonymous fallback or new authentication provider.
- Protocol 1 join carries a fresh Clerk token only in the first WebSocket frame. No room exists until verification succeeds. Default server construction without a verifier denies all joins. Five-second handshake deadline, 8 KiB frame cap, existing message/input limits and heartbeat remain, with a 1,024-transport cap. Pre-authentication pipelined commands cannot allocate seats or launch a match. Late verification cannot allocate after its transport closes. Query parameters other than the room are rejected, keeping bearer credentials out of socket URLs.
- Seat identity is verified account identity, not a connection UUID or packet seat/player ID. A room permits one seat per account. Recovery needs both the original account and its capability; invalid recovery never silently allocates a fresh seat. Capabilities rotate on every recovery; acknowledged sequence is retained and held controls cleared. Expiration is enforced inside join as well as periodic cleanup. Replaced transports are fenced from room commands while closing.
- Lobby and gameplay reconnect paths obtain uncached Clerk tokens through the existing provider. Recovery capabilities, not Clerk tokens, use account-and-room-scoped session storage. Arena stores the latest rotated capability. Terminal identity/version failures stop retries and show actionable feedback; expired sessions reconnect using fresh credentials. Session expiry immediately removes command authority and closes the connection; the existing five-second seat hold applies.
- Existing planar server simulation, room/team sizes, HTTP authentication, database, reward settlement and production deployment files remain intact. The orbital authority harness stays unreachable by live routes. No fabricated matchmaking, account rewards or shared universe state.

## Exact files changed in this continuation
New:
1. `artifacts/api-server/src/socket/auth.ts` — Clerk verification boundary and protocol version.
2. `artifacts/api-server/src/socket/auth.test-fixtures.ts` — ephemeral RSA-signed synthetic session fixtures; never imported by a runtime entry.
3. `artifacts/api-server/src/socket/auth.test.ts` — eight authentication/transport ownership/lifecycle checks.
4. `artifacts/war-for-mars/src/game/wing-session.ts` — credential-safe join helper, account storage key, terminal errors.
5. `artifacts/war-for-mars/src/game/wing-session.test.ts` — four client refresh/stale-transport/storage checks.
6. `docs/socket-identity.md` — this report.
Modified:
7. `artifacts/api-server/src/game/wing.ts` — account-owned, single-use recovery and duplicate/expired-seat checks.
8. `artifacts/api-server/src/game/wing.test.ts` — stable account fixture plus three regressions.
9. `artifacts/api-server/src/socket/server.ts` — verified joins, protocol negotiation, ownership fence and expiration.
10. `artifacts/api-server/src/socket/index.ts` — fail-closed deployment verifier configuration and sanitized port error.
11. `artifacts/api-server/src/socket/impairment-proxy.ts` — forwards the browser Origin in the existing test proxy.
12. `artifacts/api-server/src/socket/server.test.ts` — existing five transport cases now use signed synthetic sessions and assert rotation.
13. `artifacts/api-server/src/socket/network-impairment.test.ts` — signed ten-client impairment fixture and rotation assertion.
14. `artifacts/war-for-mars/src/game/WarApp.tsx` — real Clerk token provider for joins/reconnects, scoped recovery and explicit errors.
15. `artifacts/war-for-mars/src/game/Arena.tsx` — same verified recovery path, protocol validation and rotated capability storage. Prior orbital edits are preserved.
16. `docs/combat-lab.md` — current continuation pointer.
17. `docs/orbital-authority.md` — current continuation pointer.
No new third-party dependencies, package/lockfile changes, media, database/schema changes or production configuration edits in this continuation. Previously completed uncommitted branch changes remain. Build products and Preview validation/publisher records are generated evidence, not additional repository source edits.

## Reproducible verification — passed
Run from repository root; actual execution used `npx --yes pnpm@10.26.1`:
```sh
pnpm --filter @workspace/api-server exec tsx --test --test-concurrency=1 src/game/orbital-authority.test.ts src/game/sim.test.ts src/game/wing.test.ts src/socket/auth.test.ts src/socket/server.test.ts src/socket/network-impairment.test.ts
pnpm --filter @workspace/war-for-mars test
pnpm run typecheck
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/war-for-mars exec vite build --mode combat-lab
node --test artifacts/war-for-mars/scripts/preview-build.test.mjs
pnpm --filter @workspace/war-for-mars build
git diff --check
```
Windows Vite builds used the existing ignored native-tool directory with `NODE_PATH`, as recorded in `combat-lab.md`. Results: **41 server + 22 client + 2 Preview artifact checks = 65 passed**. Full monorepo typecheck, API/socket build, lab build and standard client build passed. Three new ownership regressions failed against the original seat code before implementation and passed after it. Existing 10-client room isolation/ready/start, authoritative snapshots/results, restart and impairment tests passed with real signature verification of synthetic claims. Ten-client impairment uses 12% application-frame loss, 35 ms delay with ±20 ms jitter, two hard reconnects, and matching common/final authoritative frames; the separate link test uses 20% frame loss. These are accelerated local synthetic transport tests, not internet capacity certification or ten actual account holders.

Actual nested production build and new public default entry both passed launch -> target -> 100% acquisition -> missile ammo 8 to 7 -> pulses -> one defender destroyed. Browser error and console diagnostics were empty. Local build resources were all same-origin; published game JS/CSS/favicon returned 200 from the same versioned prefix. CDN-injected analytics are not game asset references. Normal gameplay screenshot inspected: detailed ships, Mars, station and smooth asteroids remain readable; no presentation changes. One earlier validation attempt idled between tool calls until the pilot died; it was diagnosed, then retried through the actual debrief/relaunch flow without idle gaps and passed. No game patch was made to hide this normal combat outcome.

Seven-file static Combat Lab published and frontend Preview synchronized:
https://static.seeles.ai/media/3js/ff418ada-9ad6-434b-8ded-31f3ebd97a77/index.html
Canonical `index.html` manifest is ready. Preview is explicitly offline AI with no backend calls or rewards; it does not deliver the standalone socket backend. Repository source carries the networking changes for review.

## Staging integration plan and remaining gates
1. Review this isolated branch. Coordinate client and socket release: old unauthenticated join packets are deliberately incompatible and fail closed. Do not deploy the socket change alone while older clients are in use. Drain/restart existing in-memory rooms; their capabilities are not migrated. No production or remote Git operation was performed.
2. Configure the standalone socket service with `CLERK_JWT_KEY` (preferred networkless verification) or existing `CLERK_SECRET_KEY`, and `WFM_SOCKET_AUTHORIZED_PARTIES` as comma-separated **exact** frontend origins. Preserve Origin on the existing reverse-proxy upgrade path and use WSS/TLS. Do not put credentials in query strings or logs. These settings are required by the new production entry; missing/invalid configuration stops startup. No real credentials were inspected, persisted or supplied in this turn.
3. Verify two real Clerk users in staging, including fresh sign-in, expiry/refresh, account switching, same-account reconnect, wrong-account recovery and the existing backend/proxy topology. Then stage ten authenticated humans. Synthetic RSA sessions exercise the real verifier but do not prove WFM's external Clerk configuration. No external Clerk/Railway endpoint was accessed or certified.
4. Current JWT checks are signature/date/origin validation, not instantaneous session-revocation lookup. A revoked session may remain usable until JWT expiry; add an appropriate server revocation policy before ranked play. Expiry currently causes a brief reconnect rather than in-place renewal. A lost rotated-capability acknowledgement fails closed and may require a new session/room; no unsafe token reuse fallback. Per-IP/edge admission limits, abuse protection, shutdown deadline and production monitoring still require review; the global socket cap is not DoS certification.
5. This is **legacy planar multiplayer security/recovery**, not live six-axis orbital 5v5. Orbital protocol transport, interpolation/prediction/reconciliation, resync and impaired orbital tests remain ahead. The previously isolated harness is still gated. This continuation intentionally did not expose partial orbital orchestration or make local Preview depend on unavailable services.
6. No new matchmaking, team comms, tournament, persistent war/reward settlement, shared anomaly or universe work. Full server suite including DB-dependent routes was not run; focused affected suites and unchanged sim/harness were run. Real mobile devices/native apps, competitive balance and production readiness are not certified. Existing Three.js 516 KB minified / 131 KB gzip chunk warning remains; socket bundle is now ~523 KB due to the existing Clerk SDK being included.

Recommended next milestone: approved staging identity/proxy validation, then a separately negotiated orbital transport adapter using the existing authenticated seat boundary, followed by bounded client reconciliation/impairment checks. Keep rewards and public orbital enablement gated until their actual server acceptance paths pass.

## Authorized GitHub delivery attempt — historical blocker
The user has now explicitly requested pushing all improvements to GitHub. The delivery target remains the isolated `seele/combat-foundation` branch, not `main`; this does not authorize a production merge, Railway release or database mutation. Earlier no-push statements describe their historical implementation turns.

Live inspection confirmed the local branch still starts at `3ecff67` with the combat lab, Preview repair, shared authority package and socket identity changes uncommitted. Remote `main` still resolves to that baseline and no remote review branch was reported. Read access succeeds, but an authenticated push dry-run fails with GitHub's invalid username/token error. The GitHub CLI is not installed, so the repository's documented CLI credential-helper repair is unavailable. Git also reports no configured author identity. No author was invented, no secret was requested or printed, and no commit or remote write was made.

Revalidated this candidate: **41 server + 22 client + 2 Preview checks = 65 passed**, full workspace typecheck passed, API/socket build passed, isolated lab build passed and standard client build passed. The lab emitted the same hashed resource filenames as the published version. No gameplay source changed during this delivery attempt, so the existing published Preview is retained rather than claiming a new runtime release. Existing bundle-size warning and external staging limitations above remain.

Next required input: configure secure GitHub write access for `niakofa-cmyk/WFM` and a repository-local commit author name/email (or explicitly approve an automation identity). Then recheck access, stage only the reviewed source inventory, commit, push the review branch without force, and verify its remote commit hash. Build output, native tooling and validation artifacts must remain excluded. All local improvements are preserved while delivery is blocked.

## Authorized review-branch release candidate
Git Credential Manager sign-in completed successfully for the requested GitHub account, and authenticated push dry-run passed. The user supplied and approved the repository-local commit author `niakofa-cmyk <niakofa@gmail.com>` and explicitly authorized committing and pushing the reviewed improvements to `seele/combat-foundation`. The historical credential/author blockers above are resolved.

Fresh pre-commit validation passed again: **41 server + 22 client + 2 Preview artifact checks = 65 passed**, full workspace typecheck, API/socket build, isolated Combat Lab build and standard client build. The commands are listed under Reproducible verification. The existing Three.js chunk warning remains; no full DB-dependent suite, real Clerk staging users or production deployment is certified by these checks.

The release inventory combines the Combat Lab and canonical Preview repair, pure shared orbital rules and isolated authority harness, authenticated socket identity and account-owned recovery, regression tests and their three review reports. Only explicitly reviewed source paths will be staged. `.gitignore` now excludes `.preview/` local validation/authentication tooling; build output, dependencies, compiler caches and publisher/runtime records remain excluded. No gameplay, assets, database or deployment configuration changed during release preparation. The previously verified and published offline Preview is retained.

Delivery gate: create the reviewed commit, push this branch without force, and compare `git rev-parse HEAD` with `git ls-remote origin refs/heads/seele/combat-foundation`. Check remote `main` remains at the inspected baseline. Do not merge `main`, create a production release, migrate data or publicly enable the orbital harness. The next implementation milestone remains coordinated real-account staging validation, followed by the separately gated orbital transport/reconciliation work described above.
