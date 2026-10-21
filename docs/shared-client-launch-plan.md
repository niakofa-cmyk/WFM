# WAR FOR MARS — shared client and progressive launch

## Source direction and scope

Read in full: `attached_assets/Pasted-Excellent-We-ll-treat-single-player-and-real-time-multi_1792544388282.txt`, together with the owner's browser/mobile distribution direction.

Single-player and real-time multiplayer are modes of the same game. Browser play is the discovery/try-now channel; Android and iOS applications are the long-term product. Share gameplay systems, ship identity, accounts and backend contracts where practical rather than maintaining three games.

Keep Replit development and private staging. Railway remains a multiplayer-backend candidate, conditional on deployed evidence. The website is the primary browser destination; itch.io is optional discovery. Google Play and the App Store are future mobile channels. No production hosting choice, frontend migration, publishing, native build certification or store approval is implied by this document.

## Implemented in this change

### Browser solo entry

- Public, artifact-relative `/play` route, also linked from the landing page.
- No account, API authorization or multiplayer connection is required for these local flights. Authentication configuration is resolved only when entering the existing account routes.
- All eight existing ships, two-minute Practice and six-minute Strike. Strike is the player plus four AI against five AI.
- The existing `Arena` and local simulation are reused; no new combat engine or separately balanced ship roster is introduced.
- Actual match results, retry, setup, home and in-flight exit. Audio is enabled from the launch gesture.
- Optional gyro requests permission from a user gesture, handles missing APIs/insecure contexts/denial, and removes listeners when the solo entry unmounts. Touch remains the fallback.
- These are **unrewarded local trials**, not an offline campaign or a service-worker-backed offline installation. Loading the client/assets still needs a connection unless already available through normal browser caching.
- No campaign grants, local credit awards, server reward claims, market actions or saved progression are issued from this public component. Account-owned campaign/rewards keep their existing authenticated server paths.

### Frontend/backend separation

- `VITE_WING_SOCKET_URL` optionally specifies an absolute WebSocket backend address. Leave it unset to preserve existing same-origin `/ws` artifact routing.
- Initial joins and both combat reconnect paths use the same resolver, preventing reconnection to an unintended local server.
- Secure pages require `wss://`; invalid schemes, relative overrides, embedded credentials and URL fragments fail explicitly. No silent online-to-offline substitution is introduced.
- This is a **build-time public client setting**, never a secret. Do not put API keys or reconnect tokens into it.
- `WING_ALLOWED_ORIGINS` optionally restricts backend browser upgrades to exact comma-separated HTTP(S) origins. A configured list rejects missing, `null` and unlisted origins. The unauthenticated health check still works.
- Origin checks are not player authentication: a non-browser client can forge Origin. Existing input validation, rate limits, simulation authority and reconnect-token handling remain necessary; this is not complete anti-cheat protection.

### Backend trial configuration

`deploy/railway/wing-socket.toml` configures a dedicated match-socket runtime, production socket start script, `/healthz`, bounded restart retries, dependency-aware build watches and **one replica**.

Each process currently owns its own in-memory room registry. Multiple replicas would divide rooms without a shared router; do not scale replicas or regions as if room state were shared.

Before any approved isolated Railway trial:

1. Use an explicitly approved test environment/source, not an unverified promotion into the existing environment labelled `production`.
2. Keep the frontend and current progression API in their existing environments. The standalone socket process does not require copying a database or Clerk secret just to test anonymous invite-code rooms.
3. Configure the dedicated service's config path to `deploy/railway/wing-socket.toml`, bind Railway's supplied `PORT`, and set `WING_ALLOWED_ORIGINS` to the actual frontend origin(s).
4. Only after access restrictions and scope are approved, obtain the deployed socket address and build the intended frontend with `VITE_WING_SOCKET_URL=wss://<approved-host>/ws`. A private project dashboard is not application invite-only access.
5. Test HTTPS/WSS joins, ready-up, isolated invite-code rooms, reconnects and interruption notices. Record the exact deployed commit, environment, origins and measurements without access codes, credentials or personal data.
6. Do not describe a socket trial as account/progression integration: that remains a separately verified authenticated API/database concern.

No Railway configuration or live service is changed automatically by adding this file.

## All document priorities and remaining gates

| Priority | Current coverage | Evidence still required |
| --- | --- | --- |
| Core game | Existing controls, objectives, ships, actual result/reason and shared 3D Arena; public trial now reuses them | Human combat/ship playtests; full Practice/Strike completion on target devices |
| Fully playable single-player | Public AI trials do not wait for other players or a match server; existing account campaign remains separate and server-saved | Complete campaign narrative/payoff, offline-recovery coverage and end-to-end authenticated mission progression |
| Stable multiplayer | Existing isolated rooms, lobby/ready-up, authoritative room simulation, reconnect and rate limits; configurable host/origin policy added | Deployed independent devices, human-controlled ten-pilot match, real-network impairment, sustained load, consistent final outcomes |
| Match persistence | Existing alpha rule is retained: temporary disconnects reconnect while the process runs; server restart interrupts/ends active matches and requires a new room | Deployed restart behavior, abrupt-crash messaging, duplicate-reward checks; no restart-resume capability is claimed |
| Cross-platform controls | One existing WebGL client, responsive Arena controls, optional gyro and fallback | Physical Android Chrome/iOS Safari, actual native builds, dual-stick cancellation/background/rotation checks, sensor hardware |
| Production infrastructure | Frozen pnpm pin and existing CI/promotion safeguards; backend-only trial config | Environment-owned database/auth, schema rehearsals, account isolation/recovery, backups/restore/rollback, monitoring, access restriction and capacity evidence |
| Progressive release | Development → private staging → browser launch → mobile beta → public mobile release → measured growth | Owner-approved go/no-go evidence at each gate; no publishing or store submission from this change |

## Mobile acceptance targets — not certification

- 60 FPS on representative mid-range and higher-end devices.
- Peak RAM at most 1.5 GB; installation below 3.5 GB.
- Reliable dual sticks, targeting, firing, power presets, abilities, gyro opt-in/fallback and interrupted-touch recovery.
- Stable completion of Practice and a full six-minute Strike, including frame-time spikes, memory and thermal observations.

Desktop previews, browser viewport emulation, unit tests and compressed web-bundle sizes cannot certify these targets. Follow the existing `artifacts/war-for-mars/MOBILE-CERTIFICATION.md` and phone checklist.

## Native applications and itch.io are not silently added

Do not create a second Expo/native gameplay implementation or assume a website wrapper is store-ready. Choose a packaging/runtime approach only after actual-device rendering, input, lifecycle, security and account-flow evidence. Preserve shared gameplay and adapt platform integrations where necessary.

Before a mobile beta, verify signing/distribution, safe areas, suspension/resume, sensor permission, secure credential handling, account recovery, accessibility, install/download size, performance and app-review requirements. No APK, AAB, IPA, TestFlight build or store listing is supplied by this code change.

Before an optional itch.io HTML5 release, verify relative asset/routing behavior, iframe/mobile controls, external WebSocket policies and account flows for the actual hosted build. No downloadable ZIP or iframe compatibility is claimed yet.
