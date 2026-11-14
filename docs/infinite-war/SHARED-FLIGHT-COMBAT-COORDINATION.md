# Shared flight combat coordination

## Accepted spatial baseline

On 2026-11-11 the owner confirmed that two phones show their ships in the same
location with matching Moon placement and spatial framing after the coordinate
correction. This is physical-device evidence for that observed alignment, not
proof of all combat, reward, persistence or cross-instance behavior.

All subsequent combat work builds on the existing single hangar entry and
shared Orbital universe. Three.js remains the primary renderer. No additional
training world, co-op instance or fleet-battle scene is introduced.

## Three connected implementation areas

### 1. Flight controls and targeting coordinates

- Keep the server's pilot pose authoritative. Local sector rebasing is a
  rendering/precision operation, not a new world or a new simulation session.
- Transform targets, projectiles, celestial scenery and pilots into the same
  local frame. Apply the visual Y lift only while rendering.
- Use the same rendered-target distance for the visible lock marker and the
  target status panel. Never subtract a sector-local pilot from an absolute
  server target.
- Suppress the local bracket and range when the target mesh is not available;
  retain the server's target selection rather than inventing a location.
- Reject nonfinite or unrepresentable coordinates before sector rebasing can
  throw. Never display overflowing distance as a usable weapon range.
- Right-thumb translation, yaw, vector bursts and firing retain the existing
  shared control contract; no client input authorizes a hit.

### 2. Multiple human pilots in fleet battles

A friendly pilot already engaged with fleet A may accept a valid assistance
call for nearby fleet B. Exclude only pilots already participating in the
requested encounter, not every pilot with any active battle.

Selection determines which active encounter receives a help call. Acceptance
still revalidates the caller, invitation, faction, location, range, living
actors and capacity. It joins the existing encounter without creating a new
patrol reservation. Range restrictions and invitation expiry remain enforced.

Kills, assists and rewards continue to originate from server collision damage
and encounter settlement, not proximity, accepting help, or roster membership.

### 3. Friendly AI assistance and shared impacts

The existing bounded faction defender can participate in both active encounter
contracts. It physically pursues, fires and causes server-owned damage. It is
not a human participant and never acquires an account reward identity.

Both human clients must receive the same impact event identity, target,
coordinates and damage and see matching authoritative health and positions at
the same simulation tick. This does not mean every decorative friendly traffic
ship has been converted into a combatant or that an exact global 80/20
population distribution has been certified.

## Regression coverage

- Ten authenticated synthetic WebSocket clients observe the same pilot poses
  and projectile identity; two pilots' lateral/vertical motion and yaw are
  visible to every observer at a common authoritative tick.
- Two human test identities join two existing enemy-fleet encounters, including
  an assistance invitation while already fighting another fleet.
- Both humans receive identical friendly defender impacts and matching damage
  state; the defender is not recorded as a human or a rewarded account.
- Targeting/contact distances remain invariant across eight neighboring
  sector octants, including negative coordinates and sector crossings.
- Existing suites cover maintained independent locks, primary hits, kills and
  assists, settlement, disabled-ship recovery, defeating a fleet, continued
  flight and subsequent simultaneous encounters.

These are automated test identities and isolated test runtimes, not ten phones
or a fresh authenticated staging browser certification. Settlement adapters in
tests do not certify real database reward balances.

## Live acceptance still required

Use the two already-authenticated phones in Development:

1. Enter only through the hangar. Compare session, frame and Moon reference.
2. Maneuver one ship laterally/vertically and turn it; confirm the other phone
   sees the corresponding position and attitude.
3. Select the same enemy on both phones and compare its visible location and
   range. Cross a sector boundary without changing session or target identity.
4. Encounter two fleets, select the second fleet and call the allied pilot
   while that pilot is already battling the first. Accept and assist in the
   same battle, with no extra game launch.
5. Observe the AI defender's real shots/hits, shared destruction and server
   result, then keep flying toward another encounter.

Report physical-device combat results separately from the already accepted
Moon/ship alignment. Development's process-local runtime is not evidence of
Redis coordination, cross-instance failover or durable recovery after restart.
