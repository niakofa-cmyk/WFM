# Build, database, shield, and territory implementation review

## Preserved source documents

- [Clean build and continuous flight source](references/redesign/CLEAN-COMBAT-LAB-BUNDLE-AND-CONTINUOUS-FLIGHT-SOURCE.txt)
- [Faction ledger and shield impact source](references/redesign/FACTION-LEDGER-AND-SHIELD-IMPACT-SOURCE.txt)
- [Staging preflight and territory grid source](references/redesign/STAGING-PREFLIGHT-AND-TERRITORY-GRID-SOURCE.txt)

## Implemented: Combat Lab initial bundle

The failing build was caused by the `three-engine` manual chunk being hoisted
into the standalone Combat Lab's initial static dependency graph. Before the
change, the main app measured 124,612 B gzip, but Combat Lab measured 258,419 B
gzip and loaded the 131,388 B Three.js chunk immediately.

The normal app keeps its existing deferred engine split. The Combat Lab build
now lets Rollup retain the lazy import boundary instead of forcing Three.js into
a shared static chunk. Bundle auditing identifies chunks by their actual Three.js
module IDs instead of assuming one chunk name. `preview-build.test.mjs` verifies
that every Three.js-containing chunk remains outside both initial graphs.

This fixes the initial bundle budget failure; it does **not** remove Three.js
from the compatibility route or certify the full Orbital-only migration.

## Implemented: safe staging preflight

Run `pnpm run staging:preflight` to run the workspace typecheck, tests, and full
build. It is intentionally local and non-mutating: it does not print or inspect
secrets, apply database changes, call Railway, or deploy anything.

The uploaded `deploy-staging.sh` sample is not safe to run as written: it
interpolates database credentials into a shell command, does not quote those
values, applies DDL, and starts a remote deployment without an explicit
approval checkpoint. Actual staging rollout remains a separate, deliberate
action after the preflight passes.

## Database migration decision

The proposed `pilot_operational_ledger` duplicates existing application state
and does not match this repository's identity model. Player IDs are text, while
the sample creates integer pilot IDs and seeds a hard-coded pilot and balance.
Faction reputation already belongs to `player_world_state`; credits and combat
progress already use the established progression and settlement paths. The
sample's claimed enum/text conflict is not a reason to create this table.

No SQL from the upload was applied, and no database schema was changed in this
slice. A future territory store must be added through the repository's Drizzle
schema and migration flow, keyed by stable universe locations and idempotent
server-verified encounter receipts. It must not accept client kill totals or
seed fake pilots.

## Shield-impact decision

The supplied shield effect uses Three.js meshes and exposes a method that
accepts arbitrary pilot IDs and coordinates. This conflicts with Orbital's
native-renderer direction and lacks a server-authored shield-impact event
contract. Wiring it to client telemetry would permit fabricated flashes and
could imply damage that the server never confirmed.

The visual effect is therefore not added to a legacy renderer. The correct
implementation needs an authoritative hit event from the active Orbital combat
runtime, validated actor identity and pose, and a native WebGL2 effect that
consumes only that event. The current build does not expose that complete
free-flight event path.

## Territory-grid decision

The sample's process-local 16×16 `Map` resets on restart, initializes fabricated
neutral values, and wraps coordinates with modulo; negative or distant sector
addresses can alias unrelated cells. It also updates from an unpersisted
victory call, not from the existing idempotent settlement receipt.

Do not display those values as world control. A real grid must derive stable
cells from Orbital sector addresses, update in the same transaction as
server-verified encounter settlement, and expose only persisted results to a
read-only universe map. No territory state or UI is claimed by this review.

## Verification boundary

The Combat Lab and main-app bundles are measured separately. The static-load
budget is enforced for each entry, and engine chunks remain deferred. This
document does not claim that continuous server-authoritative free flight,
persistent territory control, shield-impact events, or the complete
Three.js-to-Orbital migration are finished.
