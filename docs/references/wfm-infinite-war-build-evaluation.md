# War for Mars: Infinite War — build evaluation

This reference records the integration guidance from the attached WFM build
evaluation and the resulting implementation boundary for the current codebase.
The attached source remains preserved in `attached_assets/`.

## Product direction

The universe is the battlefield. Every competitive engagement is an operation
within the larger war, and operations should have consequences in persistent
campaign and sector systems when the server validates them.

Keep the existing custom Three.js renderer and deterministic simulation. The
client owns responsive input, prediction, rendering, and effects; the server
owns multiplayer state, objective validation, identity, progression, and any
eligible reward settlement. Do not treat an offline prototype, a successful
profile read, or a healthy deployment as proof that live combat or rewards are
production-ready.

## Combat foundation

The isolated Combat Lab is an experimental, no-reward training entry. It
demonstrates three-dimensional vector flight, target acquisition, primary
weapons, and guided missiles against local AI defenders. It does not create an
authenticated socket session, write campaign progress, or award credits.

The Lab must remain separately identifiable from live Wing and co-op modes.
Its entry should be served from the same web artifact and use relative asset
paths so it works under the artifact's public path. Leaving the Lab must not
change a player's account data.

Tactical squadron orders and capital-ship subsystem objectives belong to the
server-authoritative co-op operation flow. The existing Iron Eclipse/sector
mission work is the foundation for those mechanics; the Combat Lab by itself
does not certify or replace that end-to-end mission. The next integration
milestone is to connect flight, squad orders, subsystem state, mission outcome,
and validated progression without putting the combat loop on a blocking pause.

## Integration boundary

The combat-foundation pull request was developed from an older `main` base and
overlaps newer staging code. Its self-contained orbital simulation, offline Lab,
and authority-test harness can be evaluated independently. Its replacement
socket handshake and auth configuration must not be deployed separately from
the matching client and current staging socket. Preserve the current queue,
reward, sector, and auth contracts unless an explicit compatibility migration
has passed the staging gate.

Before any live release, test the coordinated frontend/API/socket build on
staging, including reconnects, interrupted matches, unique account ownership,
server-validated objectives, and reward-ledger idempotency. Keep Production
blocked until those checks and the ordinary promotion gate pass.

## Pull-request review notes

- The combat-foundation change is broad and based on older code; integrate it
  selectively from the current staging baseline rather than replacing staging
  with its base branch.
- The public-wing duplicate-session fix is already represented in staging;
  avoid applying it a second time.
- The visual-audit checklist is documentation-only and can inform later visual
  checks without changing runtime behavior.
- The public-leaderboard, Production-auth, and staging-to-main promotion
  changes have separate release gates. Keep their open or blocked status
  distinct from whether the offline Combat Lab builds.
- Merged pull requests remain part of the project history; review their current
  effects in code rather than replaying them.

## Current scope

The integrated build adds the standalone Combat Lab to the main web artifact
and exposes it from the landing and hangar screens. It keeps live Wing socket
and authentication code on the current staging contract. It does not deploy,
promote to `main`, enable Production rewards, or claim that the complete
multiplayer Iron Eclipse vertical slice has passed physical-device testing.
