# WAR FOR MARS — Forensic Audit Action Checklist

> **Purpose:** turn the WAR FOR MARS visual/experience audit into reviewable GitHub work. This document is a tracking checklist, not evidence that the items have already been implemented or runtime-certified.
>
> **Scope:** public landing page, title screen, main command interface, mission/armory/galaxy screens, promotional-video experience, and the Niakofa Kids Play entry path. Preserve existing gameplay, authentication, progression, and multiplayer behavior unless a separately reviewed change is required.

## Status key

- [ ] Not started / not verified
- [x] Completed only when the implementation and its evidence have been reviewed
- Mark an item complete only when its acceptance criteria are met; a passing build alone does not certify visual quality or live gameplay.

## P0 — Establish the baseline and protect existing functionality

- [ ] Record the current `main` commit, deployed artifact/commit, hosting configuration, and intended public entry URL.
  - **Accept when:** the PR description links the commit and records which environment was checked; production status is not inferred from source alone.
- [ ] Capture baseline screenshots or short recordings of the public landing page, title screen, main menu, armory, campaign/mission selection, multiplayer lobby, persistent galaxy, market, settings, and gameplay entry.
  - **Accept when:** desktop and phone-sized captures are attached or linked; inaccessible/unavailable screens are explicitly marked.
- [ ] Inventory existing visual assets, dimensions, formats, licensing/source where known, and actual usage.
  - **Inspect:** `public/mars-front.jpg`, `public/war-for-mars-logo.jpg`, `public/og.jpg`, `public/x-banner.jpg`, `public/favicon.svg` and relevant launch-video assets.
  - **Accept when:** each asset is classified as keep, revise, replace, or unused; do not discard existing artwork without review.
- [ ] Map the actual routes, menu-state transitions, authentication redirects, and game-state ownership.
  - **Inspect:** `artifacts/war-for-mars/src/App.tsx`, `src/game/WarApp.tsx`, `src/game/HomeScreen.tsx`, `src/game/menu.ts`, `src/game/OnlineLobby.tsx`, plus relevant API/shared contracts.
  - **Accept when:** the map distinguishes verified behavior from assumptions and identifies state that must remain server-authoritative.
- [ ] Run the repository's documented lint, typecheck, tests, and production build before UI changes.
  - **Accept when:** exact commands and results are recorded; existing failures are documented rather than attributed to the redesign.

## P1 — Define and implement the WAR FOR MARS visual foundation

- [ ] Approve one original brand direction for WAR FOR MARS, including title treatment, emblem/insignia, typography, faction marks, environmental art direction, and motion principles.
  - **Accept when:** a compact visual spec and representative screen references are reviewed; the result is recognizably original and not a copy of another game.
- [ ] Audit the current palette and typography before changing them. Preserve useful foundations where appropriate (Void `#07080d`, Panel `#141820`, Bone `#e6e1d6`, Muted `#8d877c`, Solar `#e0a15a`, Alert `#c45c48`; Barlow Condensed/Figtree).
  - **Accept when:** final tokens have semantic names, documented use, sufficient contrast, and no conflicting duplicate definitions.
- [ ] Define distinct but coherent USSF and Accord visual languages.
  - **Accept when:** faction colors, shapes, insignias, typography/telemetry treatment, and usage rules are documented; text/icons remain understandable without color alone.
- [ ] Implement reusable presentation tokens/components in the repository's existing conventions.
  - **Candidate components:** `BrandMark`, `CommandButton`, `TelemetryPanel`, `MissionCard`, `FactionBadge`, `ShipPreview`, `LoadingSequence`.
  - **Accept when:** existing stack/build conventions are preserved; no parallel or unnecessary app architecture is introduced; shared components are used by at least the first target screens.
- [ ] Separate presentation-only state from gameplay/session state.
  - **Accept when:** redesigned UI reads the actual selected faction/ship, campaign progress, credits, mission/session and connection status; visual state cannot independently invent progression, match outcomes, or multiplayer state.

## P1 — Redesign the first three experiences

- [ ] **Public landing page:** create a cinematic Martian hero, clear game premise (USSF vs. the Accord), real gameplay/mission evidence, and one state-aware primary action.
  - **Accept when:** sign-in/sign-up and play actions use supported routes; the page remains usable when artwork fails or loads slowly; the mobile composition has a clear hierarchy.
- [ ] **Title screen:** make entering the game feel like arriving in the WAR FOR MARS universe using the approved insignia, environment, and restrained motion.
  - **Accept when:** the primary entry action is obvious, works by touch and keyboard where applicable, and has a static/reduced-motion fallback.
- [ ] **Main command center:** prioritize Campaign Deploy, Multiplayer, and Arcade Skirmish; place Armory, Persistent Galaxy, Market, and Settings in clear secondary navigation.
  - **Accept when:** each action calls the existing supported flow and displays real loading, unavailable, error, and connection states rather than decorative or dead controls.
- [ ] Create responsive desktop and portrait-phone layouts for these three experiences.
  - **Accept when:** no primary action is clipped or hidden; safe areas, readable text, touch targets, and landscape behavior are checked on real devices or documented representative devices.

## P2 — Extend the design across game systems

- [ ] Redesign mission intelligence/selection using real mission data: name, objective, location/conditions, enemy faction, threat, supported loadout, campaign status, and Deploy action.
  - **Accept when:** the UI does not advertise missions, options, or rewards that the game does not actually support.
- [ ] Refine Armory/ship selection and upgrades while preserving existing state and server-backed progression.
  - **Accept when:** selections and upgrade results match the underlying game/API state after navigation and reload.
- [ ] Align Persistent Galaxy, Market, Online Lobby, Settings, loading/error states, and gameplay overlays with the shared design foundation.
  - **Accept when:** each screen has documented before/after evidence and all existing actions remain reachable.
- [ ] Audit the separate `artifacts/war-for-mars-launch-video/` experience and reuse appropriate existing scenes/components.
  - **Accept when:** promotional branding is consistent, scene transitions are coherent, and the promo experience does not block or impersonate actual playable functionality.
- [ ] Prepare optimized artwork variants for mobile/desktop and social previews.
  - **Accept when:** image dimensions are explicit where practical, suitable responsive variants/compression are used, and image/font failures degrade gracefully.

## P1 — Verify routes, authentication, and Kids Play entry

- [ ] Verify direct entry and refresh at the intended `/kids/wfm` deployment path.
- [ ] Verify sign-in/sign-up and authentication return navigation under the deployed base path; investigate root-relative asset URLs and redirects rather than assuming they are broken.
- [ ] Verify image, font, and static asset URLs when the app is mounted below the domain root.
- [ ] Verify return navigation to Niakofa Kids Play and unauthenticated access to the intended public experience.
- [ ] Verify signed-in players can reach the game without redirect loops.
  - **Accept when:** each tested URL is recorded with HTTP/browser result, screenshot or trace where useful, and the deployed origin/configuration; production routing is tested separately from local development.

## P1 — Mobile usability, accessibility, and performance

- [ ] Check portrait and landscape layouts, small phones, tablets, and desktop widths.
- [ ] Check safe-area insets, touch target spacing, keyboard occlusion of room-code inputs, and no hover-only controls.
- [ ] Check text/background contrast, visible keyboard focus, logical focus order, accessible labels, and meaningful disabled/loading states.
- [ ] Respect reduced-motion preferences and provide a usable non-animated fallback.
- [ ] Avoid making gameplay entry depend on large cinematic assets; lazy-load below-the-fold media where appropriate.
- [ ] Measure first meaningful/interactive rendering and asset sizes on a representative mobile connection/device.
  - **Accept when:** measured results and test devices are recorded; no unsupported performance claim is based solely on a desktop preview.

## P0 — Regression and release certification

- [ ] Run lint, typecheck, unit/integration tests, and production build on the PR branch.
- [ ] Add/update browser tests for landing page, title entry, main menu navigation, authentication/base-path routing, and critical loading/error states.
- [ ] Verify campaign start and existing progression behavior.
- [ ] Verify multiplayer room creation/joining, invalid room code, connection failure, disconnect/reconnect behavior supported by the current implementation.
- [ ] Verify Armory selections/upgrades, Market, and persistent-galaxy state remain connected to existing data.
- [ ] Verify offline fallback only where the current app supports it.
- [ ] Test direct navigation and refresh on the deployed `niakofa.com/kids/wfm` route.
- [ ] Perform a real phone/browser smoke test; attach screenshots/video and record device, OS/browser, commit, environment, and test result.
- [ ] Confirm CI and required staging evidence checks are green before merge/deploy.
  - **Release gate:** no critical navigation, authentication, gameplay, progression, or multiplayer regression; any known limitation is explicitly documented. A green build is necessary but does not by itself prove visual quality or production readiness.

## Suggested pull-request sequencing

Keep each implementation PR small enough to review and revert independently:

1. [ ] **PR A — Baseline + design spec:** inventory, screenshots, route/state map, final token and faction spec.
2. [ ] **PR B — Shared design foundation:** tokens, typography, reusable components, accessibility defaults.
3. [ ] **PR C — First-entry experience:** public landing page and title screen.
4. [ ] **PR D — Command center:** main menu and existing Campaign/Multiplayer/Arcade/Armory/Galaxy navigation.
5. [ ] **PR E — Mission and secondary screens:** mission briefing, armory, galaxy, market, settings, lobby.
6. [ ] **PR F — Promotional experience and asset optimization.**
7. [ ] **PR G — Route/device certification:** regression coverage, staging evidence, and production-path smoke tests.

Do not mark a later PR complete simply because an earlier PR's shared styles compile. Each PR should list changed screens, retained behavior, screenshots, exact test commands/results, and any unverified environments.

## Pull-request author checklist

- [ ] Scope is stated and limited to the intended phase.
- [ ] No credentials, tokens, private user data, or environment secrets are committed.
- [ ] Existing gameplay, authentication, persistence, and multiplayer contracts are preserved or separately justified.
- [ ] Before/after screenshots are attached for UI changes at desktop and phone widths.
- [ ] Accessibility and reduced-motion behavior are checked where relevant.
- [ ] Exact validation commands and results are included; unrun checks are labelled **not run**.
- [ ] Runtime/deployment claims cite the environment and commit actually tested.
- [ ] CI and required staging evidence checks pass.
- [ ] Remaining issues and follow-up PRs are linked.

## Audit guardrails

- This checklist is derived from the WAR FOR MARS forensic design audit. The audit described source-level findings and recommendations; it did **not** establish that all routes, screens, assets, or live deployments had been runtime-tested.
- Treat proposed paths, components, and visual tokens as recommendations to adapt to the current repository—not as claims that these exact files or routes already exist.
- Prefer improving the existing React/TypeScript/Vite architecture over replacing working systems solely for visual reasons.
