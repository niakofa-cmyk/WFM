# Shared-flight contact, damage and destruction visuals

## Direction

The owner asks for visible projectile contact with ships and solid universe
objects, visible damaged ships, and unmistakable destruction explosions in the
existing continuous Orbital universe. Combat Lab training is the reference,
not a second game or a new launch destination.

## Connected implementation

The training renderer already presented damage tint/scorch, expanding shock
rings, sparks and destruction feedback. Shared flight previously consumed
server impact packets only to end a tracer, while hiding a destroyed ship from
the next snapshot. Remote ship meshes did not use training's damage controller.

The shared Three.js scene now:

- Applies the same damage controller to remote human and AI ship models using
  authoritative snapshot hull/max-hull values.
- Distinguishes blue shield contacts, hot hull sparks, solid-world sparks and
  destruction using validated server event data.
- Stops each matching tracer at the actual swept-collision contact point.
- Renders contacts even if the corresponding launch tracer has already expired
  or was omitted by a visual budget.
- Presents a luminous blast core, expanding camera-facing shock ring and
  three-dimensional radial spark/debris particles on confirmed destruction.
- Keeps the blast independent of the destroyed ship's mesh, so it remains visible
  after that mesh is hidden or removed.
- Uses absolute server contact coordinates transformed through the active
  shared spatial frame, including the renderer's Y offset. Active effects
  reproject when the floating origin changes.
- Deduplicates event IDs and destroyed actor IDs. Effect queues, remembered IDs,
  12 visual slots and lifetimes are bounded; resources are disposed on exit.

No visual effect grants damage, kills, rewards, collision immunity or
destructibility. There are no new gameplay entry points, damage-number boxes,
camera redirects, or rendering engines.

## Contact and destruction authority

Existing authoritative physics determines projectile/ship swept contacts and
the earliest cover hit. Registered Mars, Moon and streamed-asteroid collision
volumes stop rounds. A world contact does not destroy a planet, asteroid or
station; decorative meshes without registered collision are not thereby made
physical or destructible.

## Authoritative projectile motion

The optional `projectileMotion: { protocol: 1 }` capability on
`freeflight_joined` advertises a presentation-only stream. A new client opts in
with `freeflight_projectile_motion_subscribe`; the baseline join shape is
unchanged. Old clients receive their existing launch/contact packets, while
new clients on an old server retain the existing straight-tracer fallback.

Negotiated `freeflight_projectile_motion` packets carry a validated snapshot:
protocol, session instance, monotonic tick and at most **96** projectiles.
Each entry contains an opaque stable event ID, faction/effect, missile flag,
previous/current confirmed position, velocity and bounded remaining life.
No target identity, target position, reward, kill claim or client collision
result is accepted. The feed does not change guidance or hit calculations.

The admitted viewer must be connected to the same authoritative session.
Both the projectile position and its source's visibility must pass the
existing nearby-interest rules. An out-of-interest previous point is replaced
with the current point. Guided missiles take priority when the 96-sample
budget fills; remaining samples are sorted by distance and stable ID.
Packets are sent at most once per three simulation ticks (at most 10 Hz);
repeated subscription packets do not trigger extra snapshots.

Launch and contact IDs now derive from session instance and the durable,
monotonically assigned projectile number, **not the current tick**. They
therefore remain identical during turning, impact and checkpoint recovery.
Old checkpoints need no new mandatory schema. Presentation subscriptions are
not persisted and must be negotiated again on reconnect.

Three.js draws a short polyline through confirmed positions, interpolating
behind the latest sample rather than extrapolating a straight guided missile.
The first motion sample includes the previous confirmed simulation point.
Subsequent samples use a 100 ms presentation buffer. A delayed stream holds
the last confirmed point and hides after 350 ms; it never invents continued
flight or a hit. An authoritative contact terminates the trail at that exact
point and fades it over 280 ms, independently of the ship mesh.

Budgets: at most **160** rendered projectiles, **8** points per line, up to
**60 m** of missile trail / **8 m** of primary trail, and **1024** terminal
identities for late-packet deduplication. Empty interest snapshots retire
missing tracks; session changes, reconnects and disposal clear the buffers.
All points use the existing absolute-to-sector projection, so floating-origin
rebasing does not move the authoritative contact. Existing impact/explosion
pools and their separate limits remain intact.

With a mixed-version deployment, a projectile launched by an older server may
have the old tick-based visual ID. New motion uses the stable identity; the
old transient tracer expires normally. No combat state or reward is replayed
to compensate for that presentation-only rolling-upgrade boundary.

See [Einhänder's translation into WFM](EINHANDER-ORBITAL-DESIGN-TRANSLATION.md)
for the preserved creator reference and the rules that must not be imported.

### Motion verification

- `free-flight-projectile-motion.test.ts` runs actual server guidance and
  world collision in an isolated checkpoint fixture. Two admitted viewers
  receive one turning missile and the identical Mars contact, including an
  owner-runtime restart mid-flight. A distant viewer and a different canonical
  session receive no trajectory data; legacy clients receive no new stream.
- The saturation fixture injects 201 server projectiles to verify the cap,
  missile priority, source visibility, subscription validation and output rate.
- The existing real-input Mars firing regression now requires every surface
  event to match an actual launch's stable identity.
- `shared-projectile-motion.test.ts` checks identical terminal points despite
  receive delay, curved samples, no forward prediction, rebasing, stale expiry,
  duplicate/foreign/malformed/over-budget packets, late-event suppression and
  bounded trail history/length.

These are protocol and simulation fixtures, not authenticated staging or
pixel-level Android certification. No sign-in challenge, deployment, account
or production setting was changed for this work.

## Verification boundaries

Automated tests cover packet validation, shield/hull/world/destruction selection,
duplicate suppression, contacts without launch tracers, bounded allocation,
effect lifetime, floating-origin reprojection and cleanup. Existing training
damage-model tests verify tint/scorch changes without replacing ship geometry.

The real server-runtime regression fires rounds at Mars and requires an
accepted versioned input, weapon launch and surface impact packets, with no
false ship damage/reward. The two-pilot damage regression requires a single
lethal contact with identical destruction identity/coordinates for both pilots,
plus real damage, kill/assist settlement and continued flight.

An isolated browser-rendering diagnostic of these actual visual modules is
separate from a signed-in live fleet battle. Neither synthetic render inputs
nor test admission fixtures certify deployed human multiplayer gameplay.
The 2026-11-11 browser attempt could import the modules but could not create
either a WebGL or WebGL2 context; its GPU vendor/renderer were disabled.
Consequently this pass has no pixel-level or authenticated live-battle visual
certification. No authentication challenge or account data was changed.
The native WebGL companion's impact presentation is not redesigned by this
Three.js visual change. Production is untouched.
