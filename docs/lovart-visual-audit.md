# WFM — Lovart visual reference audit

Source: https://www.lovart.ai/canvas?projectId=2uaf5o24kqo0

## Evidence and access

The public, view-only canvas was readable without signing in. Its public page
returned 67 conversation entries, including 106,431 characters of message text,
and 24 generated image references. The full text was processed for revision
precedence; all 24 images were downloaded as reference WebPs and visually
compared in a contact sheet. Originals and raw source material are retained in
the ignored `generated-artifacts/lovart-reference/` directory, not deployment
assets. No Lovart account, private endpoint or project mutation was used.

This canvas is concept/reference art, not executable game code. Generated
lettering, apparent statistics, route prices, ship/faction assignments and
performance claims are not authoritative runtime specifications.

## Current visual direction

- Space black `#07080D`, graphite `#141820`, bone `#E6E1D6`,
  amber `#E0A15A`, and restrained Mars red `#C45C48`.
- USSF: symmetric, machined surfaces and amber running lights.
- Accord: asymmetric ceramic/intaglio treatment, a broken-wheel/plume/petal
  motif, and a restrained pale-cyan accent. Do not substitute the superseded
  generic crescent/feather emblem.
- One motivated key light, soft environmental fill, detailed planetary
  surfaces, legible silhouettes and quiet negative space.
- Dark lettering on amber-filled controls; bone lettering on dark surfaces.
  The source's stated contrast ratios are design claims, not measured evidence.
- Phone-first readable controls, minimum 44px touch targets, restrained motion,
  reduced-motion support and no decorative loops or expensive full-screen
  postprocessing.
- No third-party SPACE GEARS branding, blue-dominant HUD, neon/glow stacking,
  scanline clutter, recognizable faces or deity figures.

## Asset inventory and revision precedence

All filenames below are under `https://a.lovart.ai/artifacts/agent/`.

| Role | Current reference | Source status / interpretation |
| --- | --- | --- |
| Brand plate / wordmark | `H19H9mumoM1NQdZS.png` | Current wordmark and USSF source; its Accord symbol is superseded |
| Visual bible | `QqX1e9xHcIJ6L39K.png` | Revised visual/material direction |
| Accord faction plate | `cKlb5hCZAnLRdzzD.png` | Current asymmetric faction identity |
| Ship roster | `QMCHGh6duyJMHnUM.png` | Revised silhouettes; do not change code-owned faction or stats |
| Desktop command screen | `n7miarFEuG2xw8hD.png` | Latest contrast-corrected concept |
| Portrait command screen | `Nth5HiWTrfLwZPrA.png` | Latest portrait/contrast concept |
| Mission briefing | `gFVY3RciL09b7v2f.png` | Latest contrast-corrected concept |
| Theater travel | `F99UqiCWy7DBxnJF.png` | Latest sparse route/contrast concept |
| Hangar/refit | `fKSjAvVU1QG3gSgb.png` | Latest contrast-corrected concept |
| Landscape hangar key art | `Uxj47m8lciFmqSZ9.png` | Live key art; use scenery, not baked-in UI |
| Portrait hangar key art | `wWo6YgDc0nKpGtln.png` | Live portrait key art |
| Campaign launch art | `ZiE6h0yla3KC2AJM.png` | Explicitly out of date: old Accord insignia; excluded |

The latest screen cards still say visual contrast inspection is pending; they
are not evidence of final user acceptance. Older command, briefing, travel,
hangar and roster variants remain historical reference, not latest authority.
In particular do not promote `DQrvoPtBp32CEZuy`, `vJK5HQ8KKlGVGbDz`,
`DsE8lJgy81GbpKfg`, `cbVlgQqGlsGGSjxE`, `YgFP0osLBI78TTgQ`,
`BsOOc2k7XXESzAbb`, `fAOwkRh8RB3BObHj`, `BfCe1TH11474h58i`,
`F5PXi99r901NxWcX`, `8hxItWWdtNGss19q`, `M2MZXagv2I6TSZHw`,
or `5qvMYAjFcK3EUVMp` over those corrected references.

## Integration constraints

Preserve current data, menu actions, accessibility labels, authentication,
network protocol, authoritative field geometry, ship assignments/balance,
progression and reward rules. Do not embed a full concept UI screenshot as a
working interface or imply fake telemetry, connections, prices or scores.

Use small, optimized scenery/brand crops for command screens. Current production
crops total approximately 222 KiB across five WebPs; the 24 reference sheets
remain outside Git and deployment. Keep aspect ratios explicit and use the
artifact's base path. No Lovart service request is required during gameplay.

Flight graphics changes must stay render-only: bounded procedural textures,
shared geometry/materials where practical, no network image load in the frame
loop, no real-time shadow pass or new postprocessing dependency, and existing
pixel-ratio/input behavior preserved. Rendering must not consume simulation RNG
or alter collisions or replay checksums.

## Verification boundaries

Code/build and software-WebGL checks do not certify phone GPU performance.
Earlier phone tests apply to the earlier visuals; rerun a representative local,
no-reward flight on physical Android after these visual changes reach staging.
Keep that separate from multiplayer synchronization and reward certification.
Nothing in this visual update authorizes a Production deployment.
