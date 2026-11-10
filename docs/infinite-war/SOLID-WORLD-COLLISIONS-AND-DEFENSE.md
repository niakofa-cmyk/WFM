# Shared-flight solid world, impact metrics and defensive flare

## Owner direction

Solid asteroids, Mars and other physical bodies must obstruct flight. A visible
bullet or missile impact must correspond to authoritative geometric contact.
Use the Combat Lab's established physics and weapon behavior, not a second game
or client-authored damage. Improve survival through real defenses and movement,
not forced victories, artificial health edits or relaxed settlement checks.

## Findings and implemented slice

- Shared flight integrated movement with an empty rock list. Local universe
  collision candidates were not connected to server authority.
- Projectiles swept against ships but ignored world cover.
- Ship collision used a target's end-of-tick position. Impact effects received
  the projectile's full step endpoint rather than the first contact position.
- The canonical training flare existed, but shared flight did not execute it.

The browser and server now share bounded, coordinate-seeded collision candidates
for all 27 neighboring asteroid cells, the rendered Mars solid sphere and moon.
The renderer's 0.9m Y offset is removed from physical coordinates. The previous
320m candidate filter could omit visible rocks near sector corners; it is gone.
Caches remain bounded. Absolute server frames and rebased presentation frames
use the same source. Historical campaign/Combat Lab simulation rules are not
rewritten.

Universe movement now uses conservative swept-sphere contact: fast steps cannot
tunnel across a collider, inward velocity is removed, tangential velocity remains,
and speed telemetry is updated. Old retained poses inside a solid are separated
to its nearest valid surface, not respawned at a substitute destination. Contact
does not fabricate damage, kills, rewards or invulnerability.

Shots use relative swept motion against moving ship volumes. The earliest world
obstruction wins over a ship behind it. Locks and weapon solutions receive the
same cover candidates. Confirmed impacts terminate visual tracers at the computed
contact point, including world-cover impacts.

## Defensive capability

The server advertises countermeasure protocol 1, including the next request
sequence and remaining cooldown. The existing flare control sends a discrete
intent before continuous-input coalescing. Authority validates packet keys,
protocol, sequence, living pilot and request rate.

The existing canonical flare rule is reused: hostile standard missiles currently
tracking this pilot lose guidance; hardened seekers lose steering temporarily.
Friendly missiles, other pilots' seekers and ordinary bullets are unaffected.
The 3.5-second cooldown and request sequence survive durable checkpoints and
reconnects. No incoming seeker means no activated flare or cooldown charge.
There is no shield refill, universal immunity or invented client damage.

This is one newly connected defensive ability, not certification of every hull's
special ability. Existing hull-specific primary/missile catalog values and saved
loadouts remain intact. Aegis and Bastion are defensive hull options shown by the
normal Fleet UI; normal server selection/unlock rules still apply.

## Evidence and limits

Local regression checks cover tunneling, center penetration, tangential motion,
moving-target contact, nearest cover, sector-frame consistency, Mars/moon
coordinates, negotiated defense, malformed intents, seeker classes, friendly
exclusion, duplicate sequences and checkpoint cooldown recovery.

These collision shapes are spheres, not exact triangle-mesh hitboxes. Station
structures/docking apertures, irregular asteroid silhouette calibration and
ship-wing hit-volume calibration remain separate work. Decorative stars, labels,
navigation markers and optical effects are not automatically solid.

Authenticated staging must still demonstrate physical approaches, visible impact
alignment and a successful sustained fleet battle. Passing unit fixtures is not
proof of a multiplayer victory, positive rewards or physical-phone performance.

## Retained deployment and post-victory settlement hardening

A damaged living ship or unresolved battle can legitimately prevent changing
hulls on reconnect. That refusal produces no new admitted pilot snapshot; it is
not by itself evidence of broken rendering or a dead pilot. The server now sends
an authenticated, versioned hint identifying this pilot's retained hull, faction
and canonical location. The normal recovery screen distinguishes a living
retained deployment from a disabled ship and explains how to return to command,
restore the deployed hull through Fleet, and resume at the correct location.
The guard still rejects free repair, substitute destinations and battle resets.

Settlement results now include server-owned cumulative kill, assist and reward
totals. The HUD deduplicates encounter receipts before changing either tally or
battle phase; a replayed completed receipt must not end a later active battle.
The tally update remains pure under React StrictMode. Cumulative totals preserve
monotonic counters across reconnects; bounded receipt tracking handles older
server packets. Server credit counters use the same apply-once guard as kills
and assists.

The existing two-pilot regression now verifies real damage by both pilots,
enemy destruction, one attributed kill plus an assist, a positive kill award,
then actual movement by both surviving pilots with the same actor identities.
It checks settlement remains single after continued flight, rather than treating
an accepted input alone as proof of exploration. The native WebSocket regression
also exercises a second fleet becoming active while the first result settles.

These are local runtime fixtures with test settlement adapters, not authenticated
database certification. Existing economy policy is unchanged: assists are real
tallies, but do not mint an extra kill or an unconfigured assist payment.
Authenticated staging still needs a fresh two-pilot destruction/settlement/
continued-flight pass. Browser diagnostics now distinguish missing sockets,
rejected snapshots, server refusals and graphics/asset boot failures; test
graphics support is checked before opening new sign-in challenges.
