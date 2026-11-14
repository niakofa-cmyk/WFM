# Shared Orbital universe: two-phone verification

## Player entry and gameplay

Enter through the landscape hangar's **ENTER THE UNIVERSE** button on both
devices. There is no separate campaign, local flight, or training world to
select. Asteroid 5v5 competition is the only approved alternate gameplay.
World docks and station services remain inside continuous exploration.

Each device needs a **different signed-in pilot account**. A second connection
for the same account is a reconnect, not a second ship.

## How to establish that the phones share live flight

1. Use the same Development game address on both phones.
2. Enter the universe. Open **PILOTS** on each phone.
3. Compare the **location** and **SHARED SESSION** identifier. They must match
   for this nearby-visibility check.
4. While both pilots are near one another, each phone should count **2 HUMAN**
   including its own pilot, and list the other pilot as **HUMAN**, not **AI**.
   Compare **FRAME** as well. **SECTOR / LOCAL XYZ** and **MOON RANGE / ΔXYZ**
   now expose the server-confirmed spatial reference. Distinct ships need not
   have identical coordinates or Moon ranges; they must agree on where the
   Moon and each other's ships physically are. See
   `SHARED-CELESTIAL-REFERENCE-FRAME.md`.
5. Fly or fire on one phone and verify the other sees that ship move or fire.
6. Approach the same hostile fleet. Both phones must see the same hostile
   ships, destruction, and battle outcome—not a new fleet copy for each pilot.
7. Choose the same faction to test assistance. One pilot starts fighting;
   the other approaches the same fight or accepts a wing support call.
8. Verify the nearby **AI WING DEFENDER** actually attacks hostile ships.
   Human calls and automatic AI reinforcement are distinct systems.
9. Finish the battle and keep flying without entering another gameplay mode.

Different locations are spatial regions of the same universe, not an assertion
that every distant pilot is immediately visible. Exact ship poses are streamed
only to authenticated nearby participants. If the locations differ, meet at the
same location before comparing nearby rosters. If a ship is disabled, use its
recovery controls; reconnect must not silently repair it.

## Automated checks added for capacity

- Ten separately authenticated test WebSocket clients see the same session,
  actor roster and authoritative projectile event.
- A dense AI directory cannot consume the ten reserved human seats.
- Ten participants, including late arrivals, share one encounter reservation.
- Attribution accepts the bounded expanded roster; only actual contribution
  creates kills and configured rewards.
- A bounded friendly defender joins two encounters and emits real damage.

These are deterministic/in-process server tests with an injected test-session
verifier, not ten physical-device or real Clerk sign-in certification.
Existing regression checks separately cover kill/assist settlement, continued
flight, additional fleet encounters, target locks and human assistance calls.

## Operational limits

Development currently uses one socket process and server-owned location
sessions. These tests do not certify cross-process Redis failover or durable
restart recovery on the running Development environment. A matching session ID
and live reciprocal visibility are required before claiming the phone test
passed. Competitive queue enablement and rewards remain separate operator gates.
