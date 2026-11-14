# Einhänder reference translated to WFM's living Orbital universe

## Source and limits

The creator supplied the complete forensic architecture analysis, preserved
unaltered in [the reference archive](references/EINHANDER-FORENSIC-ARCHITECTURE-CREATOR-REFERENCE.txt).
Its SHA-256 is `7eba9739636fd7ca8277a40e80318eeebc85d53e58135d6c3496f835b52193d6`.
This is design research and proposed reconstruction, **not** an original-source
audit, licensed artwork, or proof that every proposed WFM feature already works.
External credit, historical and performance claims are attributed to that
document; they are not independently certified here.

## Preserve WFM's foundation

- One hangar entry into the continuous, persistent multiplayer Orbital universe.
- Three.js remains the primary renderer inside that universe; the supported
  native WebGL companion does not introduce a second authoritative game.
- Preserve full three-dimensional flight, heading-stable player-controlled
  camera, shared celestial coordinates and server-owned movement and combat.
- Do not import a side-scrolling plane, rail stage, forced camera swing,
  instantaneous loadout replacement or client-authoritative rewards.
- Keep the asteroid competitive arena as the already-authorized alternative;
  the reference does not authorize a new standalone training game.

## Apply the useful ideas

| Reference idea | WFM application and status |
| --- | --- |
| Distinguishable projectiles and readable impacts | Implemented here: capability-negotiated, bounded server projectile positions, curved missile trails and stable launch/contact identity. Existing faction/weapon colours, server surface contacts and destruction effects remain. |
| Military equipment with physical mounting limits | Build on existing compatible primary/secondary/special/defensive hardpoints and server-verified wreck recovery. Do not replace them with unrestricted gunpod swaps. |
| Destroy functional components | Build on existing engine, weapon, shield, sensor and other subsystem consequences. Component disable is not automatically a hull kill. |
| Beginning, escalation and resolution | Build on persistent patrol operational state and living formations; command exposure, retreats and assistance must reflect existing ships and observed threats, not fabricated reinforcements. |
| Enemy silhouettes and coordinated formations | Preserve faction hull identities; future art/formation changes must retain mobile visibility and measurable rendering budgets. Do not copy referenced game artwork. |
| Dynamic cooperative combat | Nearby authenticated allies and eligible friendly AI participate in the same authoritative encounter; no separate co-op mission runtime. |
| Score and risk/reward | Retain verified kill/assist attribution, recovery and settlement. A historical multiplier is not permission to issue unvalidated currency or permanent damage inflation. |
| Cinematic industrial atmosphere | Use contrasting faction weapons, readable silhouettes and local contact effects. Lighting, audio and additional assets remain separate work; camera choreography must not take control from the pilot. |
| Efficient architecture | Keep lazy renderer loading, bounded effects, negotiated protocols and deterministic shared simulation. Do not replace tested systems with speculative sample code. |

## This implementation's evidence boundary

The missile path work is presentation fed by the existing authoritative runtime.
It does not change weapon damage, guidance physics, ammunition, collisions,
targeting permission, kill ownership or reward settlement.

Protocol and runtime fixtures can prove curved guidance, shared surface contact,
interest isolation, compatibility, deduplication and restart identity. They
cannot certify an authenticated two-phone staging battle or Android frame time.
No staging deployment or fresh sign-in is implied by archiving this reference.

See [shared combat visual authority](SHARED-FLIGHT-DAMAGE-AND-EXPLOSION-VISUALS.md)
for the implementation contract and verification record.
