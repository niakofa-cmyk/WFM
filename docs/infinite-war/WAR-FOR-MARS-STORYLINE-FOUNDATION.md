# WAR FOR MARS: INFINITE WAR — foundational storyline direction

## Status and precedence

This is the owner-directed foundation for the game's central premise, principal
human antagonist, Mars conflict, and long-form mystery. The full supplied
storyline premise is preserved verbatim at
[`references/redesign/Pasted-Absolutely-This-is-the-original-premise-we-should-build_1794063278746.txt`](references/redesign/Pasted-Absolutely-This-is-the-original-premise-we-should-build_1794063278746.txt).

This guide governs narrative meaning and continuity. The
[Mars chronology](MARS-STORY-CHRONOLOGY-AND-CANON.md) records how the premise
relates to existing authored campaign facts and where details remain
unresolved. The [connected-storyline rebuild](CONNECTED-STORYLINE-AND-ADVENTURE-REBUILD.md)
governs how story, routes, operations, and world events connect. The
[Orbital Engine-only renderer directive](ORBITAL-ENGINE-ONLY-RENDERER-REBUILD.md)
governs the runtime target and current migration evidence.

**Engine boundary:** Orbital Combat Engine is the exclusive target game engine
and rendering runtime. Three.js is a source of techniques, not a target
renderer. The checked-out game still contains Three.js-based compatibility
rendering; the Orbital-only migration is a target, not a completed migration.
Do not mistake a historical pull-request proposal or current implementation
inventory for the controlling architecture decision. Retire compatibility
rendering only after the existing Orbital migration gates pass.

## The premise

Eon Dusk is the central human antagonist and the catalyst of the Mars war. He
amasses extraordinary wealth and political influence, builds a private
expeditionary force through military, corporate, aerospace, robotics, and
autonomous-systems relationships, and secretly launches for Mars to claim
control of the planet. His objective is control, not a peaceful research visit.

Mars is not unclaimed. Dusk's expedition encounters the Accord of Dharma and
Ma’at, an established civilization with its own history, institutions, and
reasons to defend the planet. The confrontation destroys Dusk's fleet and
special force. Dusk is the only known survivor and is captured by the Accord.
Before the expedition is lost, a transmission reaches Earth reporting his
capture. The transmission triggers a political and military crisis; the USSF
becomes the principal military instrument of an escalating conflict, while
private backers, political actors, and Dusk loyalists pursue competing aims.

The United States government is not a single, fully informed character. Some
people support Dusk, some seek to control his project, some exploit the crisis,
and others do not know the operation's full purpose. Do not flatten those
interests into one motive or attribute an action to an institution unless the
story establishes it.

The central question remains deliberately difficult: did Dusk believe he was
securing humanity's survival, manipulate that fear to justify domination, or
both? His intelligence and conviction do not make him a misunderstood hero or
voluntary truth-teller. His capture is the catalyst for the war, not proof that
his motives were noble.

## Three layers of truth

Reveal the story through three overlapping perspectives. They are narrative
layers, not three objectively complete accounts:

1. **Public account:** Dusk is an American space pioneer captured by the Accord,
   and Earth must respond to the loss of its expedition and leader.
2. **What powerful actors know or want:** Dusk attempted to seize Mars; parts
   of a political, military, financial, and technology network knew more than
   the public and have conflicting interests in the war.
3. **What remains unknown:** the Accord, Mars, and the signal are connected to
   a history beyond either faction's present conflict. Evidence gradually
   introduces **The First Witness** as the deeper mythic and cosmological
   mystery; do not reveal its nature, origin, or answer prematurely.

The first transmission may contain more than a report of Dusk's capture. The
signal and The First Witness may connect the human war to something older, but
the exact relationship is a mystery to discover through authored evidence,
operations, characters, exploration, and consequential player choices—not
exposition that resolves itself at the start.

## Factions, characters, and cultural care

- **Eon Dusk:** a powerful, ambitious, manipulative human antagonist who
  believes humanity's future must be controlled by someone with sufficient
  power. Preserve the tension between his stated existential fear and his
  attempt to rule Mars.
- **USSF and human power networks:** institutions and individuals have
  different information, loyalties, and goals. A player should encounter
  conflicting orders, incomplete intelligence, and consequences rather than a
  monolithic human side.
- **The Accord of Dharma and Ma’at:** develop the Accord as a civilization, not
  merely an alien visual style. Give it internal political disagreement,
  military and scientific institutions, histories, and competing philosophies.
  Egyptian and Hindu traditions, and other traditions named in the supplied
  premise, are sources for careful research and respectful inspiration; do not
  collapse living cultures or religions into one purported historical system.
- **The First Witness:** a slow-burn mystery that expands the stakes beyond
  Mars. Its evidence must not erase the human causes or consequences of the war.
- **Supporting characters:** Mara Venn, Tarek Sol, Nadiya Sen, and WARDEN-0 are
  proposed roles from the supplied premise. Their characterization and exact
  connection to implemented operations remain to be authored and checked
  against existing game material.

## Story as the connective structure of play

The premise should give players reasons to travel, investigate, fight, escort,
defend, build alliances, and influence events across the universe. The campaign
is one authored path through a larger world; it must not make exploration,
supported multiplayer operations, or returning to the story feel like separate
games.

- Keep Contact, Beacon, Warden, Cage, Rust Disc, Mars Approach, Pale Beacons,
  and Iron Eclipse recognizable. Share places and evidence where appropriate,
  but do not merge distinct server-owned operations, IDs, results, or unlock
  chains without an explicit, tested contract migration.
- Let discoveries and missions reveal different layers of truth. A route,
  optional encounter, recovered record, or faction event should contribute to
  the same broad history without becoming a mandatory mission rail.
- Use player choices and validated outcomes to change operation consequences
  and, when supported by server authority, visible world state. Local previews
  do not grant multiplayer authority, persistent history, kills, faction
  standing, or rewards.
- Keep authored lore, proposed connective explanations, unknowns, and
  implemented behavior visibly distinct in both documents and the interface.
- Expand beyond Mars only as locations, routes, encounters, and consequences
  become supported; do not use the word “infinite” to imply unbounded live
  simulation.

## Continuity with the current campaign

The owner-directed premise establishes that the Accord captured Dusk after the
expedition was destroyed and that a transmission carried news of the capture to
Earth. This adds the prehistory that explains why the USSF–Accord conflict
exists. It does not by itself resolve the later Cage operation's exact custody
transfer, transport route, or why its current brief describes a USSF escort
while the Accord must stop the transport. Preserve that authored brief and mark
the intervening continuity for reconciliation; do not invent a transfer or
change a faction objective silently.

The established signal facts remain important: the signal predates the
USSF–Accord front, the Pale Beacons received it for years, a Warden order to
erase the Cage, its cargo, and route also predates the front, and the signal
repeats from beneath Mars. The origin of the signal, identity of the suppressor,
issuer of the erasure order, and the signal's exact relationship to The First
Witness remain unknown until authored evidence resolves them.

The current story-facing map order remains Contact → Mars Approach interlude →
Beacon → Warden → Cage → proposed Iron Eclipse → future Beyond the Signal. It
describes a story thread layered over the game, not a new campaign prerequisite
chain. Keep the cooperative Rust Disc → Mars Approach → Pale Beacons sequence
separate.

## Implementation status

The verbatim premise is archived and this foundation is now the story guide.
The universe atlas presents its short premise summary and three layers of truth
alongside the existing Mars story thread. That presentation is navigation and
narrative context only; it does not add launch actions, account writes,
operation authority, progression gates, or rewards.

The premise, factions, and mystery are **design direction**. Existing campaign
content remains the implemented baseline unless a separately reviewed story
change updates its source, tests, and server contracts. The Orbital-only engine
is likewise the **target architecture**, not proof that all current
Three.js-based renderer paths have already been migrated.

## Next narrative work

1. Reconcile the original expedition/capture/transmission with the Cage
   transport brief without changing its existing faction objectives by
   assumption.
2. Build a source-backed story bible for Dusk's network, the Accord's motives,
   USSF's internal disagreements, and the staged First Witness revelations.
3. Connect the next bounded story slice to real route and operation identities,
   then prove authority, replay, interruption, and consequence behavior before
   calling it a live universe feature.
