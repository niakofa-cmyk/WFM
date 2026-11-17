# Current player entry policy

The landscape hangar's **ENTER THE UNIVERSE** gateway is the entry into
continuous, shared Orbital gameplay. Three.js remains its primary renderer.

## The one approved alternate gameplay

**Arcade Skirmish 5v5 competition at the multiplayer asteroid** is the sole
approved alternate gameplay entry. It is reached through Cinder Ring's
services inside the live universe, not a direct hangar deployment or URL.

Keep the existing Cinder Ring docks, Mars night-side station, and other
physical station/access points throughout the universe. They remain reachable
destinations with docking, services, and a return to exploration. Restricting
alternate gameplay must not remove their physical structures or interactions.

The existing multiplayer implementation is **Wing Relay 5v5**, not the
standalone solo Arcade simulation. The competition interface explicitly
identifies its current Wing Relay rules. This change does not silently replace
the server simulation with solo rules or certify a new competitive ruleset.

- Competitive entry requires authenticated identity, a server-verified Cinder
  Ring location, and both client and socket operator queue enablement.
- Ten distinct human pilots are required; AI fill is not a competitive fallback.
- Queue cancellation leaves the pilot in the universe.
- The existing competition result/debrief returns to the universe.
- Live spectating remains authenticated, read-only and anonymous.
- Reward policy remains separately server-owned and gated.
- Private rooms and casual AI-fill are not exposed in the current player entry
  interface. Historical backend compatibility and saved data remain intact.
- Legacy flight, expedition, play and standalone Combat Lab URLs return to the
  hangar. No separate local docking or training launch is offered at Cinder.

This policy supersedes conflicting entry-point wording in historical
`ASTEROID-COMPETITIVE-HUB.md` documentation. It does not certify live ten-pilot
matchmaking, cross-instance persistence, or reward payout; those require
separate authenticated runtime evidence.
