# Connected-universe entry redesign — implementation evidence

## Scope

The first redesign slice changes the existing `/combat-lab.html` entry rather
than creating a new app, renderer or combat engine. The controlling brief is
[Redesign direction](REDESIGN-DIRECTION.md).

Both owner sources are archived byte-for-byte and all five supplied images are
saved as reference assets. They are not embedded as supposed WFM gameplay.

## Implemented

- Original orbital navigation presentation with five selectable destinations.
  Selection drives the same destination briefing and launch action.
- Mars Orbit launches the existing offline Orbital Arena with the original
  training setup and selected faction/hull; its result returns to the entry.
- Cinder Ring lazy-loads the existing local docking approach with the selected
  faction/hull. Docking or aborting returns to the same entry. Completion does
  not enter a room, grant a seat, record travel or issue progression.
- Three proposed destinations show planned/unavailable status with launch
  disabled. They do not fabricate players, schedules or cosmic events.
- A real account-hub link retains the existing authenticated services.
- Faction selection updates a local briefing for the existing opposing AI
  training side; approach and planned destinations explicitly avoid fabricated
  patrol, allegiance and persistent-world claims.
- The latest Infinite Open Universe directive is mapped to the actual partial
  A–J state in the direction brief; one canonical Orbital engine remains the
  target, not a claim that retained mode-owned scenes have already migrated.
- Keyboard arrow navigation, radio selection semantics, touch targets,
  portrait scrolling, landscape layout and reduced-motion rules.
- Arena, docking and Three.js stay deferred. No new external font resource is
  added by this entry document; browser font fallbacks remain available.

## Verification

| Check | Result |
|---|---|
| WFM TypeScript check | Passed |
| Game/auth test suite | 267/267 passed, including four new destination, local-boundary and faction-briefing guards |
| Main app and standalone entry builds | Passed |
| Static resource and lazy-renderer build checks | 4/4 passed |
| Desktop preview, 1440 × 900 | Entry rendered; no browser errors |
| Phone-layout preview, 402 × 874, full page | Scrollable entry rendered; mobile map-label placement adjusted |
| Reference archive | Complete source matched original bytes; five images preserved |
| Direction-file local links | Verified |
| Development frontend | Restarted successfully |

The tests check destination identity/status/coordinates and guard deferred
loading, planned-launch restrictions and faction-opponent messaging. Screenshots check the initial visible
layout, not interactive flight. Existing Arena launch props and approach
callbacks were checked in source; neither full flight journey was driven in a
browser during this slice. No actual Android hardware, authenticated multiplayer
or event-streaming certification is claimed.

## Not implemented by this slice

Persistent spatial travel, unlimited streaming, new station geometry, live
Orbital multiplayer, nearby battle proxies, authorized 3D spectator cameras,
deterministic cosmic-event scheduling and all-mode migration remain separate
engineering work. The chart is a local entry interface, not persistent universe
authority or a completed universe simulation.

No backend/auth/database/reward/feature-flag changes, staging promotion or
Production deployment were performed. The earlier engine regression report
remains evidence for its own revision; no backend rerun is inferred here.

## Rollback and continuation

The UI change can be reverted independently: restore the previous entry and
HTML metadata, then remove the new chart, destination data and styles.
Shared flight simulation, stored player data and online services are unchanged.

Continue by connecting existing account-backed discovery/location state to the
same presentation through its real contracts, then verify universe-to-operation
handoffs. Build actual observer/event capability before showing live battles
or countdowns.
