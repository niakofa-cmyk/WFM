# One living universe, one shared campaign

## Owner direction

All authenticated pilots enter the current shared story, never a personal
campaign runtime. If the world is 50% complete, a newcomer arrives at 50%.
Leaving at 30% and returning after other pilots advance the war to 70% means
returning at 70%. A pilot's absence does not pause the campaign. Completion ends
this campaign for everyone, preserves its history and earned equipment, and
opens permanently idempotent finale rewards for its participants.

Spatial shards are regions within this same timeline, not independent campaigns.
Development, staging and Production must remain isolated deployment environments;
they must never share credentials or silently share a live campaign database.

## Uploaded references

Verbatim originals are under `references/`:

- `global-campaign-timeline-original.txt`
- `global-campaign-finale-and-load-original.txt`
- `global-campaign-deployment-and-shields-original.txt`

These are design inputs, not evidence of completed deployment, measured latency,
bundle size, load capacity or working production systems.

## Implemented foundation

- PostgreSQL stores one versioned campaign, its unique verified encounter events
  and participating accounts. Redis is not the durable campaign counter.
- Winning, server-owned continuous-flight patrol settlements advance the timeline
  once per encounter, not once per pilot. The same transaction commits campaign
  progress, battle rewards and patrol outcome. Any failure rolls the work back.
- The adopted **provisional** tuning policy uses the uploaded 50,000 collective
  operation target and phase thresholds at 25/50/75/100 percent. This is a
  collective-warfront counter, not proof that every authored story chapter,
  branch, evidence condition or physical operation is globally connected.
  Replace provisional thresholds with canon-approved shared objectives before
  calling the complete storyline integrated.
- Repeated victories cannot increment the same event twice. A conflicting
  fingerprint fails closed. Counts cannot exceed the configured target.
- Authenticated entry registers participation while the campaign is active.
  A newcomer after conclusion cannot register a fresh finale entitlement.
- At completion, the flight gate refuses new entries and weapon/control input;
  existing server simulations stop as they observe the durable completed state.
  Bounded database refresh is used, not an unproved zero-latency broadcast.
- The account UI polls shared state and shows the same percent and phase to all
  accounts. The hangar briefing uses that global phase rather than personal
  `cleared` when the feature is enabled. Link failures are not displayed as 0%.
- The finale panel ends the playable campaign and exposes claimable rewards.
  Participation survives logout. Returning participants can claim later without
  replaying chapters or resetting the world.
- Finale awards use the existing permanent progression ledger unique key, an
  account row lock, and one transaction. Credits and actual Shield Mk2 unlock
  commit together. Campaign XP and the commemorative badge are retained in the
  receipt; campaign XP is not represented as an existing pilot-level increase.
  Existing earned weaponry, loadouts, credits and discoveries are not erased.
- Reward-policy version one currently grants 5,000 credits, 1,000 campaign XP,
  the Infinite War Veteran badge and the existing Shield Mk2 unlock. New
  imaginary weapon IDs from the sample were not inserted as unusable gear.

## Single player-facing entry

The signed-out main entry now goes to account access, not local Orbital flight.
The hangar's deployment action requires authenticated shared flight and verified
world location. It never silently substitutes a local campaign. Compatibility
entry links are hidden from the normal hangar; developer diagnostics remain
available only through the explicit Development diagnostics view. Their source
is preserved for testing/rollback, not treated as another shared story.

## Safe adoption boundaries

`WFM_GLOBAL_CAMPAIGN_ENABLED=true` enables the new contract in Development after
the additive `0007_global_campaign.sql` migration. Staging requires its own
approved migration, matching frontend/API/socket revisions and feature setting.
Production has not been migrated or deployed by this implementation.

The uploaded Redis counter/checkpoint example was not copied: it can lose clears
on restart, has no durable event deduplication and can race on phase transitions.
The 24-hour finale lock was rejected because expiry could permit repayment.

The unbounded 450-client Pub/Sub flood is not a real authenticated fleet test:
it does not verify delivery, latency, loss, simulation authority or rewards.
No hour-long infrastructure load test or claimed sub-2ms certification was run.
A later staging soak must be rate-bounded, observable and explicitly authorized.

The proposed deployment script was not adopted: it assumes unavailable package
commands, measures unrelated bundles, directly migrates Production and treats
rollout invocation as proof. Preserve the existing reviewed release process.

Shield-impact visuals remain a separate rendering slice. The provided single
shield mesh is not a 200-ship pool, its decay is frame-rate dependent, it lacks
disposal and its Fresnel term can be negative. Adopt pooled, disposable effects
from verified hit events in the existing lazy Three.js path rather than copying
those claims or changing collision/damage authority.

## Evidence still required

Local database tests isolate and roll back all test data. They check unique
shared clears, final transition, retry-safe claims, persistent entitlement and
no progress beyond conclusion. Socket tests check refusal after the shared
campaign ends. These are not live two-device or restart-and-reward staging
certification, nor proof that every historical campaign branch is connected.
