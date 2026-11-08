# Open-universe patrol encounter slice

## Current continuous-flight opening direction

The bounded pocket below is a historical implementation slice, not the desired
opening architecture. The owner's current direction and implementation are in
[Combat Lab-style opening inside the live universe](LAB-STYLE-OPENING-ENCOUNTER.md):
explicit hangar launch inserts a new pilot facing a real hostile patrol, reserves
the ordinary shared encounter, and retains the same universe after battle.
Training behavior is reused without importing local authority or respawning
rewardable fleets. Reconnects preserve the existing craft and battle.

## Direction retained

The two owner-supplied fleet references are retained verbatim in
`references/redesign/MASTER-SPACECRAFT-FLEET-WEAPONS-DIRECTIVE-2026-11-07-SOURCE.txt`
and `references/redesign/FORENSIC-SPACECRAFT-FLEET-EVALUATION-2026-11-07-SOURCE.txt`.
The attached fleet images are stored under `references/fleet/`.

Choosing a USSF hull must place Accord patrol ships in opposition; choosing an
Accord hull must place USSF ships in opposition. The selected hull and faction
come from authenticated server-validated expedition input. Region, patrol,
roster, movement, damage, destruction, attribution, and settlement are server
owned. Defeated patrol ships are removed from the shared strategic roster so
other pilots see the resulting fleet loss.

The current rendering strategy keeps Three.js as the primary 3D renderer and
scene-runtime foundation, integrated with Orbital's shared gameplay/simulation
contracts. This slice reuses the existing Orbital flight adapter and current
renderer without adding a second gameplay runtime, universe, or authority.

## First playable scope

- A Galaxy patrol listing links to a server-authoritative Orbital patrol
  encounter.
- The server resolves the pilot's saved location and the opposing faction's
  persistent patrol; a room code or client-supplied location cannot select a
  target.
- A bounded formation of visible enemy fighters moves in 3D during flight.
- The pilot can damage the nearest surviving contact through the existing
  authoritative flight simulation. The server attributes each destroyed hull.
- A completed extraction settles 12 credits per server-confirmed hostile hull,
  capped at 48 per encounter, through the existing idempotent exploration
  ledger. Aborted encounters record no credits.
- Encounter leases prevent two rooms from claiming the same patrol at once.
- Confirmed casualties update the shared roster; an empty patrol disappears
  from the strategic directory.

## Explicitly not certified by this slice

This is a bounded encounter pocket, not seamless server-authoritative free
flight. It does not implement the complete fleet directive: capital ships,
subsystems, complete shield simulation, coordinated formations, independent
ship AI tactics, fleet reinforcements, faction-wide strategic scoring,
physical Android performance, multi-process live combat streaming, or
Production rollout remain separate work and test gates. The current renderer's
mobile performance is not inferred from a desktop build.

## Release boundary

The additive schema change is for Development only until separately reviewed.
Do not deploy this revision to Railway staging or Production until the matching
database schema is applied there through the documented environment-specific
migration process and the authenticated multiplayer/reward checks pass.
