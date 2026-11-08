# Orbital is the game — controlling rebuild clarification

## Owner direction · 2026-11-06

**Build the new War for Mars: Infinite War universe and multiplayer game
inside the Orbital Combat Lab engine foundation. Do not leave Orbital as
an optional offline training link beside a separate universe game.**

The owner specifically identified the current Home-screen presentation:
`COMBAT TRAINING` → `Orbital Lab · local arcade compatibility` →
`ORBITAL COMBAT LAB · OFFLINE` / `Canonical local combat training · no rewards`.
That is the current access path, **not the desired final product architecture**.

Re-engineer the Lab's end-to-end function flow into the main game execution
path. The owner has since explicitly chosen immediate Three.js removal and
retirement of modes without Orbital-native presentation. This removes old
presentation routes; it does not claim their feature or multiplayer parity.

This clarification governs the maintained rebuild/redesign files wherever
older wording could justify leaving Orbital as a side mode. Preserve the
unchanged source documents as historical references.

## What is wrong with the current separation

The current code still has the following source-backed split:

| Current owner | Actual function | Required rebuild destination |
|---|---|---|
| `src/App.tsx` and `game/HomeScreen.tsx` | Present the standalone Lab link under training | Main game entry must lead into the Orbital-powered universe; training is an activity within it |
| `src/combat-lab.tsx` / `CombatLab()` | Owns local faction, hull, selected destination, `entry/arena/approach`, run and summary state | Evolve this foundation into the primary game/session owner, not a second world front end |
| `combat-lab.tsx` / `launch()` | Switches to fixed local training or a practice approach | A single runtime launch/transition contract selects world activity and authority without choosing an unrelated engine |
| `game/Arena.tsx` | Owns local combat scene, camera, input sampling and gameplay loop | Extract reusable flight/combat/render lifecycle into the Orbital runtime; training becomes a mode configuration |
| `game/CinderRingDockingApproach.tsx` | Owns a separate local docking scene; now shares Orbital input, flight rules and camera helper | Approach/docking becomes a world location/activity under the same universe runtime/session |
| `game/input.ts`, `PilotFlightStick.tsx`, shared pilot adapters | Produce the working two-thumb pilot controls | Preserve these controls through exploration, approaches and combat; do not regress the established throttle and direct roll |
| `lib/orbital-sim/src/` | Provides shared flight, weapons, deterministic rules, mode definitions and runtime identifiers | Remains canonical gameplay foundation; shared imports alone are not full runtime consolidation |
| `combat-lab.tsx` / `HUB` | Navigates to another document at `/universe` for account/world services | Attach existing account/world services to the main Orbital experience; that link is an interim bridge, not completed rebuild |
| Local `onDone` / `onDock` / `onAbort` callbacks | Return to a local selection screen and summary | Return to the retained universe session/location through explicit, authority-aware transitions |

The new chart, account-navigation link and Cinder input migration are useful
interim work. **They do not establish a playable open universe inside one
Orbital runtime.** Relabeling the current card or redirecting it to the chart
would not satisfy this rebuild.

## Required target execution flow

```text
War for Mars game entry
    → primary Orbital runtime initialization
    → universe session + selected ship + controls + camera/render lifecycle
    → playable Mars/orbital/sector exploration
    → physical asteroid, station or anomaly discovery and approach
    → operation adapter + existing server authorization where required
    → local / campaign / co-op / competitive gameplay
    → validated outcome and debrief
    → return to the retained Orbital universe session
```

“Universe session” and “primary Orbital runtime initialization” describe
required responsibilities, not new modules already implemented by this file.
Do not create a separate universe engine to satisfy the diagram.

### Runtime ownership

- The Orbital foundation owns game execution: simulation stepping, spatial
  world state, player flight, input consumption, presentation/camera lifecycle
  and transitions. Make mode/world configuration explicit rather than adding
  more independent React-root/scene loops.
- Build the expanded universe **through that runtime**: planetary/orbital
  navigation, sectors, asteroids, stations, anomalies and activity entry.
  A galaxy chart alone is not spatial exploration.
- One runtime foundation does not mean one enormous server simulation.
  Authoritative match instances may scale independently behind versioned
  operation adapters while retaining one coherent player journey.
- The final game uses Orbital Engine as its sole rendering and gameplay
  foundation. Three.js is removed, not retained as a shipped or deferred
  renderer. The active playable scope is the native Cinder Ring slice.
- Unported legacy presentations are retired, not compatibility or rollback
  paths. Preserve their server-owned identity and operation contracts, then
  restore player entry only after Orbital-native presentation and authority
  behavior have been rebuilt and verified. See the
  [renderer rebuild directive](ORBITAL-ENGINE-ONLY-RENDERER-REBUILD.md).

### Services and authority

- Reuse existing identity, saved ship/loadout, settings, world/travel,
  matchmaking, sockets, progression and reward owners. Integrate services
  into Orbital; do not replace or duplicate their authority.
- Preserve independently runnable no-reward training. Offline execution is
  an authority/capability profile of the foundation, not the definition of
  the entire new game and not a dependency on hosted sign-in.
- Online exploration/operations use appropriate server authority. A local
  docking result, chart click or flight animation cannot grant persistent
  location, a match seat, credits, mission completion or rewards.
- Private and AI-fill restrictions, campaign replay compatibility, account
  isolation and competitive reward gates remain unchanged.

## Ordered rebuild and proof gates

1. **Extract the Lab lifecycle.** Inventory the entry, match, flight,
   rendering, camera, controls and exit functions. Establish the runtime/session
   owner and versioned mode/authority contracts without adding another engine.
2. **Run a playable universe in it.** Replace the isolated three-defender
   training flow as the main experience with a bounded navigable Mars/Cinder
   world under the Orbital lifecycle. Keep training available as a subordinate
   activity. Streaming/sector expansion can grow from this tested foundation.
3. **Keep transitions inside the game.** Approach a physical location, enter
   one real supported activity and return to the same universe session.
   Reuse existing services; do not count a full-page link to the old account
   universe as completed runtime migration.
4. **Connect verified online operation adapters.** Preserve existing server
   admission, gameplay, reconnect, completion and reward boundaries. Do not
   claim live observer battles or ten-human Orbital multiplayer from fixtures.
5. **Promote the primary entry only after proof.** Update the opening/Home
   navigation to the completed Orbital universe experience; move training
   beneath it. Do not just rename an offline training link “Infinite Universe.”

Minimum first acceptance loop:

**Main entry → playable Orbital universe flight → physical Cinder destination
→ supported operation entry → gameplay/debrief → return to the retained world.**

Verify one input/flight rule path and one declared active renderer owner
throughout the loop, no duplicate animation/simulation drivers after repeated
entry/exit, and preserved ship/controls/session context. Real connected
operations additionally require appropriate server evidence. Physical Android,
network/reconnect and performance claims require their own tests.

## Status of this clarification

**Partially implemented, not a complete runtime rebuild.** The first bounded
local universe slice now runs exploration, physical station docking, training
and retained-state return within one existing Arena lifecycle. The default boot
routes both Mars and Cinder selections into that runtime; standalone training
and docking scenes remain explicit compatibility options rather than parallel
primary paths. See
[the slice evidence and limitations](ORBITAL-LOCAL-UNIVERSE-SLICE.md).
The historical separation table above describes the audited starting point.
Legacy entry paths remain compatibility access. Browser end-to-end flight
certification, connected authority, account-persistent unlimited exploration,
interstellar travel and all-mode migration are not established by this increment.

Related maintained documents:

- [Redesign direction](REDESIGN-DIRECTION.md)
- [Structural rebuild roadmap](STRUCTURAL-REBUILD-ROADMAP.md)
- [Master directive reconciliation](MASTER-DIRECTIVE-RECONCILIATION.md)
- [Main engine architecture](engine/MASTER-ENGINE-ARCHITECTURE.md)
- [Implementation evidence and limitations](REDESIGN-IMPLEMENTATION-REPORT.md)
- [Mars planetary routes and adventures](MARS-PLANETARY-ROUTES-AND-ADVENTURES.md)
- [Orbital Engine-only renderer rebuild](ORBITAL-ENGINE-ONLY-RENDERER-REBUILD.md)
