# Connected Orbital universe navigation

This implements the next three navigation/integration steps in the redesign,
not continuous infinite flight or a completed universe simulation.

## 1. Connect account-owned position

- The standalone `/combat-lab.html` remains independent of hosted authentication
  and server availability. Its account link now opens `/universe`.
- `/universe` uses the existing Clerk provider and account game shell. Signed-out
  visitors receive a sign-in link with an internal return destination and a link
  back to offline training; no world/progression hooks mount before a confirmed
  session.
- The account universe reuses `GalaxyScreen`, `useGetWorld`, the saved player
  profile, existing control preferences and durable-action recovery. The shared
  Orbital chart consumes only locations/coordinates reported by the server.
- Current position is always `world.currentLocation`, never the selected marker.
  Clicking a marker is inspection only. A page reload queries account state again.
  Existing account-shell unmount/cache clearing separates users.

## 2. Connect the real operation directory

- Reuse `useGetWorldOperations` and the existing read-only operation event stream
  with polling fallback. No second directory, socket authority or fake activity.
- Join operation sites to their `worldLocationId`, and hide operation listings at
  locked destinations. Only public definitions are projected into the chart.
- Count only public, unexpired assembling/ready/active instances at the matching
  site. Do not expose their IDs, room codes or pilot identities in this projection.
- Zero sessions means catalog-only, not an active competition. Published local
  training sessions are explicitly not multiplayer. Loading, missing-directory,
  stale-world and genuinely empty responses are distinct states.
- The older activity feed now distinguishes directory failure from zero activity
  and prioritizes its loading state correctly.

## 3. Connect existing authorized controls

- A destination's current route availability, cost, unlock state and account
  credits control its travel action. Stale/paused/error world reads disable new
  navigation actions.
- Paid travel requires an explicit confirmation containing the route cost and
  saved-location consequence. Cancel/marker selection/polling never submit travel.
  Confirmation is invalidated if the origin, destination, fare, availability or
  busy/stale status changes.
- Confirmed travel delegates to the existing durable travel action, including the
  route's `maxCost`. The server remains responsible for cost, eligibility,
  idempotency, location updates and ledger writes. Unknown outcomes retain the
  existing recovery mechanism; there is no optimistic local movement or reward.
- Opening an operation scrolls/focuses its existing controls only after current
  location and fresh directory checks. Competitive operations lead to Cinder
  Ring's approach or docked hub; this does not create a seat or skip docking.
  Local flight registration and co-op still use their established entry controls.
- Private-room creation/join, competitive queues, spectating, gameplay runtimes
  and reward contracts are unchanged. No new reward eligibility is enabled.

## Verification and boundaries

- WFM typecheck, model/integration-source guards, existing game/auth tests and
  both static builds cover this change; exact results are recorded in
  [the redesign implementation report](REDESIGN-IMPLEMENTATION-REPORT.md).
- Browser UI checks must distinguish real signed-out handoff from isolated
  component-fixture checks. A fixture cannot certify authenticated transport,
  paid travel, saved-location persistence, live match admission or Android flight.
- No database schema, backend contract, auth provider, package, deployment,
  simulation rule or replay version changed.

## What still must be built

Continuous sector traversal, floating-origin/streaming ownership in canonical
Orbital, persistent faction patrols and encounter decisions, meaningful anomaly
physics/travel, and the complete launch/explore/fight/join/return acceptance
journey remain incomplete. Server-approved route travel is not free flight.
