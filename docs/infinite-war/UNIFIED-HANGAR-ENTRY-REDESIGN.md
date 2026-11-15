# Unified Hangar and Single Universe Entry

## Direction

Current entry/recovery implementation and the optional public historical
opening are specified in [Opening, Hangar and Recovery](OPENING-HANGAR-AND-RECOVERY.md).
Account boot shows command; only explicit Enter Universe mounts live flight.
The gateway enters the main Orbital flight scene, not a second universe or a
replacement strategic chart. Historical references to account-theater-first
navigation below are superseded on that point.

WAR FOR MARS opens into one persistent military command hangar. The player's
saved faction and airframe are visible there, and one prominent **ENTER THE
UNIVERSE** action leads into the connected theater. It is the single primary
gateway; Mars, Cinder Ring, stations, patrols, operations, and other destinations
are discovered and selected after entry rather than through competing hangar
launch buttons.

The hangar is a command environment, not a mode-selection lobby. Fleet and
loadout management, operations, multiplayer, settings, and communications are
secondary systems reachable from the same shell. The primary hangar operations
screen is full-screen landscape. USSF and Accord are selectable directly from
the faction warline; changing faction uses the existing saved-loadout service
and retains only hulls valid for the chosen faction. Portrait remains a readable
device-orientation prompt, not a vertically stacked game layout. The command
hangar asks pilots to rotate into landscape. It must not borrow social-network
navigation from the visual references.

## Entry and authority boundaries

- Boot and authentication resolve the pilot profile before the hangar shows the
  saved faction, ship, credits, or progress.
- **ENTER THE UNIVERSE** opens the existing connected account-theater screen.
  That screen owns persistent travel and server-backed activity discovery.
- USSF/Accord selection uses the existing loadout persistence path; a faction
  switch selects a compatible roster hull instead of displaying an invalid
  faction/ship combination.
- Operations and multiplayer remain reachable through their existing server
  contracts. The hangar must not fabricate a location, live battle, reward, or
  matchmaking seat.
- Local Orbital flight remains an explicitly labeled practice path with no
  account rewards. It is not presented as proof of shared-world flight.
- Existing title, armory, campaign, Wing, and recovery paths are retained while
  their navigation is consolidated incrementally.

## Renderer boundary

The hangar ship inspection now uses the shared Orbital-native hull geometry and
its own lightweight WebGL2 presentation renderer. It does not create a Three.js
scene or import the Three.js package. This is a hangar-presentation migration,
not proof that every legacy operation renderer has already migrated. Preserve
working legacy paths until their Orbital replacements pass feature, authority,
performance, and rollback checks.

## Reference archive

The two original user-provided direction documents are preserved verbatim in
`references/unified-hangar-entry/`. The concept image and six supporting
screenshots are retained there as optimized JPEG reference copies. The
reference UI is guidance only: its resources, rank, social controls, messages,
and live battles are not evidence that WFM has those features.

The intended adaptation is:

| Reference idea | WFM application |
| --- | --- |
| One large “Enter the Universe” gateway | Open the connected WFM theater |
| Persistent military hangar | Show the saved pilot hull and command systems |
| Fleet, loadout, mission, multiplayer, settings access | Reuse existing WFM panels and endpoints |
| Three experience preview tiles | Explain operations, exploration, and fleet command without pretending they are separate launchers |
| Wide command environment | Use a full-screen horizontal landscape layout; show a rotate-device screen in portrait |
| Aircraft inspection and post-flight screens | Preserve hull inspection; keep actual verified debrief/progression contracts |

## Source documents

- `references/unified-hangar-entry/UNIFIED-MILITARY-HANGAR-DIRECTIVE.txt`
- `references/unified-hangar-entry/UNIFIED-HANGAR-REDESIGN-REVIEW.txt`

## Acceptance checks

1. The hangar has one visually dominant `ENTER THE UNIVERSE` action, and it
   opens the connected theater.
2. Secondary controls remain accessible, keyboard-operable, and do not create
   competing primary universe gateways.
3. The saved ship is rendered by Orbital-native geometry, with accessible
   keyboard and pointer inspection.
4. Landscape is the only hangar presentation layout; portrait shows a clear
   rotation prompt rather than reflowing the command deck vertically.
5. The local training path remains explicitly no-reward.
6. Existing campaign, multiplayer, profile, and server-authority behavior is
   regression-tested; no engine migration is declared complete from this screen
   alone.
