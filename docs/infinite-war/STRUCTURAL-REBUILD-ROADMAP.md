# WAR FOR MARS: THE INFINITE WAR — structural rebuild roadmap

The complete owner-supplied source is preserved unchanged in
[`STRUCTURAL-REBUILD-STRATEGY.txt`](./STRUCTURAL-REBUILD-STRATEGY.txt).
The controlling full-game orbital migration source is preserved unchanged in
[`../../attached_assets/Pasted--WAR-FOR-MARS-THE-INFINITE-WAR-MASTER-ORBITAL-ENGINE-CO_1793798261341.txt`](../../attached_assets/Pasted--WAR-FOR-MARS-THE-INFINITE-WAR-MASTER-ORBITAL-ENGINE-CO_1793798261341.txt);
its maintained migration plan is
[`ORBITAL-ENGINE-CONSOLIDATION-DIRECTIVE.md`](./ORBITAL-ENGINE-CONSOLIDATION-DIRECTIVE.md).
The later repository-specific diagnosis is preserved unchanged in
[`REPO-UNIFICATION-REQUEST.txt`](./REPO-UNIFICATION-REQUEST.txt).
This maintained guide summarizes its decisions and applies them to the current
codebase. The source document remains authoritative if this summary and the
original differ.

## Product direction

**The universe is the battlefield.** The player should enter one connected
world, belong to one faction, configure one ship, take operations in that world,
and return to a hangar where validated outcomes create the next opportunities.
Campaign, cooperative play, competitive warfronts, exploration, economy, and
progression are activities within one game—not separate games presented as
unrelated menu commands.

The target is an authored, expandable universe with bounded simulations, not an
unbounded count of live ships or a literally infinite galaxy.

## Preserve before replacing

- Keep the custom Three.js/Vite runtime as the initial foundation. Needle remains
  a research/authoring candidate, not a second production runtime.
- Evolve Orbital Combat Lab into the canonical combat foundation for the
  entire game. All modes ultimately use its versioned simulation; consolidate
  overlapping flight rules only after parity and rollback are proven.
- Retain Rust Disc, Mars Approach, Pale Beacons, and Iron Eclipse as flight,
  exploration, and cooperative operation content.
- Retain the existing authenticated 5v5 Wing matchmaking, reward ledger,
  account isolation, reconnect behavior, and private/AI-fill boundaries.
- Retain the existing campaign, Armory, market, inventory, persistent Galaxy,
  and account-scoped progression. Connect them incrementally rather than
  creating duplicate player tables, auth systems, ledgers, or matchmakers.
- Never retire a working path until its replacement, data compatibility, tests,
  and rollback are proven.

The repository-specific request correctly identifies that the phone command
screen presents separate systems with too much equal visual weight. Its
suggestion to scrap the older flows is not a safe first step: campaign, Wing,
and cooperative paths have different verified account, server, and reward
contracts. Consolidate the player-facing hierarchy first, then migrate one
runtime/operation contract at a time without presenting unintegrated systems as
already unified.

## Delivery sequence

| Stage | Goal |
| --- | --- |
| A | Forensic inventory and architecture assessment |
| B | Unified opening, hangar, operations, and universe navigation |
| C | Canonical orbital flight, targeting, weapons, damage, and readable feedback |
| D | Campaign briefings, objectives, debriefs, and validated progression |
| E | Connect existing cooperative sectors and Iron Eclipse |
| F | Integrate orbital combat with authenticated competitive Wing |
| G | Settle validated progression, economy, discoveries, and war consequences |
| H | Expand bounded fleet battles, AI, anomalies, and new sectors |

Each stage needs a working build, automated tests, explicit acceptance criteria,
and documented limitations before expanding scope.

## First unified playable slice

1. Introduce the Mars conflict and the USSF/Accord stakes.
2. Choose a faction and configure a saved ship/loadout in the 3D Hangar.
3. Select Rust Disc from universe/operations navigation.
4. Launch the canonical 3D combat runtime and complete an objective through
   targeting, weapons, damage, and extraction.
5. Debrief, return to the Hangar, and apply account progression only from a
   validated server result.
6. Unlock the next story operation through the existing account progression.

This is not complete merely because its screens or isolated simulations exist.
The end-to-end flow, server authority, account preservation, and device behavior
must each be verified.

## Mandatory authority and safety

- Clients may render, predict, and animate; they do not decide competitive
  damage, outcomes, mission completion, rewards, or persistent war state.
- Ten distinct authenticated humans are required for reward-eligible 5v5.
  Private rooms and AI-fill remain separate and no-reward.
- Mission/claim retries must be idempotent. Incomplete, interrupted, replayed,
  and invalid outcomes must not produce progression or credits.
- Keep new gameplay bounded, deterministic, synchronized, and behind the
  appropriate feature flags. Test mobile rendering separately from network and
  server behavior.
- Do not claim features are integrated, deployed, or device-verified based only
  on a build or simulation test.

## Current implementation checkpoint

As of 2026-11-04, PR #11 remains an open draft against `staging`. It selectively
integrates the orbital combat foundation without replacing the staging
authentication/socket contracts. The custom runtime and server-owned
cooperative/competitive safeguards remain in place.

Recent player-journey work carries the saved Hangar hull into the local Rust
Disc briefing and explicitly keeps that trainer no-reward and non-persistent.
The Galaxy now identifies the next incomplete story-sector operation from
recorded flight discoveries and carries its mission ID into Expedition. The
Expedition selector accepts that navigation hint, but existing account-progress
and server prerequisite checks remain authoritative.

The public landing now emphasizes account entry or local solo flight and groups
the alternate Rust Disc, Combat Lab, and co-op routes in an expandable
operations panel. The signed-in mobile command screen presents the campaign as
the primary operation, keeps server-run co-op visible as another operation
path, and groups local Rust Disc, offline Combat Lab, and alternate Arcade
entry points in an expandable Flight & Combat Systems section. All previous
routes remain available; this is a navigation consolidation, not evidence that
their simulation runtimes have already been merged.

The first unified campaign-to-validated-progression loop, shared 10-human
orbital 5v5, persistent faction consequences, and mobile-device acceptance
remain incomplete until their specific gates pass. PR #11 being open or passing
workspace checks does not establish those capabilities.

### Incremental campaign-combat migration

The first campaign operation now uses the canonical orbital combat runtime:
clients advertise orbital-replay support, and the server selects `orbital-v1`
for capable Contact runs. Older clients that omit the capability and all other
campaign runs use `surface-v1`; runs issued before model versioning also default
to that legacy behavior.
Contact resolves through its “break the defending wing” branch. Standalone
Combat Lab remains local/no-reward, and competitive Wing, cooperative sectors,
Iron Eclipse, and the socket protocol are unchanged.

This advances one bounded campaign slice, not the complete Stage C–D journey.
Automated client/server replay and reward-claim checks are not staging, phone, or
Production verification. Do not promote the change until its exact staging
revision passes the appropriate authenticated campaign and reward checks.
