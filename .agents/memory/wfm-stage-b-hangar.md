---
name: WFM Stage B hangar and player journey
description: Near-term implementation sequence for connecting hull selection, the hangar, and a playable orbital operation without replacing existing systems.
---

The owner-supplied Stage B review is preserved at
`attached_assets/Pasted-WFM-repository-review-current-implementation-and-Stage-_1793753885183.txt`
and copied unchanged to `docs/references/wfm-stage-b-hangar-review.txt`.

The review identifies the signed-in command center as a wall of mode commands
and proposes a unified player journey:

**Hangar → select and save hull/loadout → operation briefing → Rust Disc orbital
mission → objective → debrief → return to Hangar.**

Implement this in small playable slices using the current Three.js/Vite runtime,
canonical `SHIPS`/`ROSTER` data, existing procedural orbital hull models, and
current account-backed loadout persistence. A selected hull is not saved until
the existing server-backed save callback succeeds. Keep the Accord's amber/gold
identity distinct from the USSF's silver/blue identity.

Keep current foundations intact: Clerk and account boundaries, saved loadouts,
campaign progression, the 5v5 Wing matchmaking/reward contracts, co-op sectors,
and their release gates. Combat Lab remains offline/no-reward; guest play remains
offline training. Do not create a second engine, duplicate auth or reward
systems, fake hull selections, or label future destinations as implemented.
Needle remains a research/authoring candidate, not a second production runtime.

The review's sequence is B1 onboarding, B2 actual 3D hangar, B3 hull selection,
B4 contextual hangar navigation, and B5 the connected deployment/debrief loop.
It does not certify any of those stages as complete. Both supplied ChatGPT share
links returned HTTP 402 and could not be reviewed; use the attached review and
current repository as the available evidence.

The owner supplied two sets of four visual references: cinematic hangar/ship
selection images, then aircraft selection, stat, debrief, and multiplayer-home
screens. Use them for scene atmosphere and information hierarchy: a dominant
inspectable craft, legible real hull metrics, a clear save/select action, and
readable operation entry points. Build original WFM art rather than shipping
reference screenshots as runtime assets. Keep the live procedural Three.js hull
and canonical faction colors. Do not copy unrelated aircraft, branding, currency,
reward values, or game-specific labels into WFM.

**Why:** the owner designated this review as a current build reference. It
prioritizes a coherent first-player journey while explicitly protecting working
authentication, multiplayer, progression, and reward behavior from a risky
rewrite. The supplied imagery is a visual reference, not authority to replace
WFM's actual saved hull or claim a static render is a playable 3D model.

**How to apply:** inspect the current flow before each slice, reuse existing
routes/callbacks/server-owned saves, and test the whole journey. Keep local,
staging, and Production claims separate. Do not merge or deploy Production
without the required staging evidence and explicit authorization.
