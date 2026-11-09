# Shared battle indicators and nearby assistance

## Scope

Shared free flight uses only authoritative patrol contacts. An empty, cleared,
connecting or unavailable shared snapshot must not restore a local preview
contact or display a preview battle as a live encounter. Local compatibility
training retains its explicitly labelled preview. Final server completion clears
the old interception notice; another active fleet still keeps combat controls.

The HUD fix does not change damage, fleet spawning, authority, leases, kill
attribution, reward rates or existing Wing/sector protocols.

## Local verification

- Rendering tests require an empty authoritative roster to remove the entire
  stale preview/engagement notice. Both factions, dead/friendly/distant contacts,
  live replacements and local compatibility previews remain covered.
- The existing nearby late-ally runtime test verifies automatic participation
  in the same reservation, usable server weapons, idempotent join notification
  and rejection after admission moves to a different location.
- A new accelerated native-runtime test starts two ordinary allied Mandjets
  against one ordinary hostile Duskbreaker. Only normal server-admitted opening
  insertion and flight/weapon inputs are used; it never sets positions, health
  or damage. Both pilots inflict server damage, one earns the kill, the other
  earns the assist, both survive, and one settlement is recorded.
- The settlement adapter in this local test is a mock consuming the real
  encounter receipt. It is **not** proof of a deployed database balance change.
- Existing policy pays credits for approved NPC kills, not assists alone.
  The assist-only pilot therefore receives one assist and zero credits in this
  test. No assist-credit policy has been invented or enabled.

## Paired authenticated staging acceptance

The prior staged directional-controls run proved movement and bursts for two
authenticated pilots and a surviving rewarded flight for one. It did not prove
same-battle assistance. That gap remains open until the following all pass.

1. Obtain approval for a paired app/API/socket staging revision. Production,
   staging access protection and separate authentication/data stay unchanged.
2. Open fresh normal sign-ins for the two existing staging test profiles. Keep
   codes private, submit once to each retained challenge, and require active
   sessions plus authenticated profile HTTP 200.
3. Attach allowlisted observers before entry. Freeze each profile balance.
   Select the same faction and an existing defensive hull through normal
   hangar/fleet controls **before either pilot launches**.
4. Launch both into the same authenticated location promptly. Confirm both have
   fresh snapshots, live pilots, nearby allied pilot presence and a real
   opposing persistent fleet. Never manufacture a fleet, force a pose, steal a
   reservation, revive a pilot locally or relax the 180-metre join envelope.
5. Require matching server encounter/patrol fingerprints and an allied join
   event with at least two participants. Two signed-in windows, similar ship
   names or separate victories are insufficient.
6. Aim both pilots at the same visible hostile actor and verify real damage
   from each before the kill. The local staging driver can constrain its normal
   aim/fire inputs to a fingerprint of an actor already in its snapshot; absence
   of that target must stop the attempt, not select another fleet silently.
7. Require settled kill/assist records for that encounter. Compare each frozen
   balance against its own accepted award, including a legitimate zero-credit
   assist under the current policy. Do not report the assistant as paid merely
   because the killer's balance increased.
8. Verify surviving flight in the same universe and that the cleared hostile
   roster leaves no stale local patrol prompt. Preserve a distinct active fleet
   if one remains. Treat lost targets, different encounters, destroyed pilots
   or unavailable settlement as partial/inconclusive results, not passes.
9. Restore the original saved faction/hull through normal controls, retain
   genuine earned progression, and close the bounded browser owners.

## Evidence handling

The local browser observer retains raw game geometry only in memory and emits
hashed actor/encounter identities, nearby ally distances, participant counts and
allowlisted combat summaries. Never emit user identities, cookies, tokens,
verification codes or full auth responses. See `STAGING-TEST-REPORT.md` and
`STAGING-TEST-RESULTS.json` for deployed evidence and its explicit limitations.
