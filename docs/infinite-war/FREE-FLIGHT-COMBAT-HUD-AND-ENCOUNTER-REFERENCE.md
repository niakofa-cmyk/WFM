# Free-flight combat HUD and encounter reference

## Saved visual reference

The user-provided screenshot is preserved at
[`references/free-flight-combat-hud-reference-2026-11-08.jpg`](references/free-flight-combat-hud-reference-2026-11-08.jpg).
It shows a landscape Orbital flight combat view with:

- a live enemy contact card naming faction and ship, showing range, shield and
  hull integrity;
- a centered flight reticle, visible 3D spacecraft, Mars and asteroid traffic;
- two-thumb flight controls, combat actions, camera and pause controls; and
- compact high-contrast HUD placement that keeps the flight view primary.

Use this as a functional layout reference, not as evidence that the pictured
screen is currently the shared-universe runtime.

## Direction

Combat training is a source of proven HUD and control behavior, not a separate
universe entry point. Patrol detection and battle discovery belong inside
Orbital free flight. Keep the local compatibility trainer available for
regression and fallback checks, but do not route a pilot through it to reach the
persistent universe.

Values shown for a live patrol must come from the authenticated, server-owned
free-flight snapshot. Client estimates may guide presentation but cannot
authorize damage, kill credit, faction outcomes, or rewards. The current patrol
intercept request remains subject to the server's approach and combat gates.

## Implemented reference slice — 2026-11-08

- The in-flight patrol contact card now shows the server-reported faction, hull
  class, range, shield, and hull values when those values are present in a fresh
  authenticated shared-flight snapshot.
- The card is positioned in the landscape HUD's upper-left contact area and
  retains the existing server-gated intercept action.
- Strategic patrol projections that do not include live integrity do not show
  invented shield or hull percentages.
- The attached image is retained in this reference directory.

This is a contact/HUD integration slice, not continuous-flight combat. The
free-flight socket still rejects weapon intents; it does not yet run live
projectiles, damage, kill/assist attribution, persistent casualties, or rewards
inside the continuous shared flight session. The existing authenticated
`universe-patrol` operation still runs its battle in the sector combat runtime.
Keep that distinction explicit until the shared-flight combat contract and
staging checks are implemented.

## Next engineering gates

1. Bring Orbital weapon intents into the shared-flight server simulation. The
   server must validate target identity, faction, range, facing, cadence, ammo,
   projectile collision, shield/hull damage, and encounter eligibility.
2. Publish authoritative target/weapon feedback so all nearby pilots see
   consistent impacts and destroyed ships in the same 3D session.
3. Reuse the existing exploration-result and reward-settlement contracts only
   after persistent patrol identity, kill/assist attribution, reconnect replay,
   and anti-farm policy are bound to the shared session.
4. Keep training/local compatibility, shared free-flight combat, and
   reward-bearing server operations visibly distinct in tests and UI.
5. Verify both factions, both supported renderers, multiple devices,
   disconnect/reconnect, duplicate settlement, and the no-reward fallback on
   staging before enabling rewards broadly.

See also:
[live patrols and pilot presence](LIVE-3D-FREE-FLIGHT-PRESENCE-AND-PATROLS.md)
and [the server encounter contract](PRIMARY-ORBITAL-BOOT-AND-ENCOUNTER-CONTRACT.md).
