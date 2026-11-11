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

Primary projectile visuals extrapolate launch velocity. Contact flashes and
tracer endpoints use the authoritative impact point. This change does not
introduce a continuous server trajectory feed for homing missiles.

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
