# WFM opening experience — implementation and verification

## Source and interpretation

The owner's complete 782-line document is retained verbatim in
[`references/wfm-forensic-design-audit.md`](references/wfm-forensic-design-audit.md).
It is design input, not a runtime audit or evidence of Production readiness.
This implementation follows its explicit recommendation to begin with the
public landing, cinematic title, and main command center.

The working baseline was `26d9269` on `feature/public-wing-leaderboard`.
That is a repository baseline, **not a verified Production deployment revision**.
No Railway inspection or deployment was required or performed.

The document describes some pre-Lovart source: the current command screens
already used optimized hangar artwork and the supplied wordmark rather than
`mars-front.jpg`. Those assets were preserved. Existing Barlow Condensed,
Figtree, palette, router, state machine, authentication and backend boundaries
were retained rather than replacing the application architecture.

## Implemented

| Area | Result |
| --- | --- |
| Public discovery | Responsive orbital-hangar hero, supplied branding and faction marks, existing solo/account entry links, faction context, real campaign sortie cards, existing opt-in public leaderboard |
| Title arrival | Branded arrival and sweep animations; existing `START` transition behind Enter the War; usable without motion |
| Command center | Desktop command/briefing/online regions; portrait stacking; selected ship and faction, actual balance, completed sorties, campaign briefing and existing destinations |
| Multiplayer | Create/join private room, AI-fill queue, competitive queue, cancellation, status, disabled states and offline option retained |
| Shared presentation | Reusable panels, labels, branding, schematic, button classes, faction accents, safe-area spacing and focus styles |
| Assets | Intrinsic image dimensions, deployment-base-relative paths and intentional gradient background if images fail |

The briefing consumes the existing ship definitions and completion count.
The next mission comes from the actual campaign list; completed campaigns are
labelled for replay rather than displaying an invented fifth sortie. Its pure
presentation helper cannot unlock, save or modify progression.

The inline ship graphic is explicitly labelled **SCHEMATIC**. It is a
faction-family illustration, not a newly imported ship mesh, live tactical
sensor, or representation of an individual ship's collision shape.

There is no new standalone package or separate design-system application.
The shared presentation foundation remains inside the existing game client.
No new dependency or additional cinematic image download was introduced.

## Contracts preserved

- Wouter's existing deployment base remains authoritative for navigation.
  Root-local `Link` destinations are intentional inside the base-aware router.
- Clerk providers, route paths, token bridge, account guards and authenticated
  API handling are unchanged.
- No private player ledger is added to the public landing.
- Private and AI-fill modes remain unranked/no-reward; competitive still requires
  ten human pilots and server-verified rewards when enabled.
- Existing room, queue and navigation callbacks remain connected.
- Game simulation, ship balance, collision geometry, socket protocol, player
  records and reward settlement are untouched.

## Local verification — 2026-11-01

- `pnpm --filter @workspace/war-for-mars test`: **70 passed, 0 failed,
  0 skipped**. Five added tests cover campaign briefing boundaries, real sortie
  selection, replay semantics, command destinations and launch sequencing.
- `pnpm run typecheck`: **passed** across the workspace.
- `pnpm --filter @workspace/war-for-mars build`: **passed**, final build 5.29 seconds.
- `git diff --check`: **passed**.
- The existing game workflow restarted successfully; Vite reported ready.
- Public landing and actual command component were checked at **360×803**,
  **803×385** and **1280×900**. No horizontal overflow; command images loaded;
  visible command buttons met the 44px minimum.
- Command rendering used isolated synthetic props, not an authenticated player.
  The expected 123-credit fixture and actual Warden briefing for two completed
  sorties rendered. This does not certify real account loading or persistence.
- Synthetic callback checks reached campaign deploy, create room, join room,
  both queues, cancellation and title `START`. Both queue actions were disabled
  while queueing. These checks did not create rooms or submit API writes.
- Cancellation remains available if queue availability is withdrawn while
  queueing. A nested-router fixture using the application's actual Wouter
  module resolved the leaderboard link to `/kids/wfm/leaderboard`.
  This is not a live Niakofa route or authentication-redirect test.
- Reduced-motion emulation disabled the title arrival animation.
- With all `/lovart/` image requests blocked, the intentional gradient remained,
  solo and account entry links remained visible, and there was no horizontal
  overflow. The fallback check issued **zero POST requests**.
- No page exceptions occurred in the layout/command check. The clean preview
  screenshot reported a Development-key warning and unavailable experimental
  WebGPU, not a React rendering failure; neither establishes Production auth.

Screenshots are under ignored `generated-artifacts/visual-rebuild/`.
The screenshot capture and isolated command checks are local browser evidence,
not physical-device, network multiplayer, or live Production certification.
The owner declined an additional two-phone graphics test; none was requested.

## Deliberately not claimed complete

The reference's five-phase strategy also describes new cinematic assets,
individual ship previews, extended mission and hangar redesigns, a promotional
film refresh, Niakofa discovery pages and full live-route certification.
Those are not supplied by this opening-screen implementation.

The separate launch film, native Android package, Railway services, external
Niakofa application, authentication configuration and Production deployment
were not altered. This work does not enable Production or certify any pending
competitive reward claims.
