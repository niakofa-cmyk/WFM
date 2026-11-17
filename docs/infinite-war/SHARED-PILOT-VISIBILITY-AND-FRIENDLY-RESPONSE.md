# Shared pilot visibility and automatic friendly response

## Owner-observed failure

The owner tested two devices and reported that the pilots were not visible to
one another and friendly AI did not assist. Treat that as failed player-facing
acceptance, regardless of prior successful socket deployment or startup logs.

The supplied address is this workspace's Development preview. The signed-out
primary boot offers a local solo universe; a browser reaching that page is not
proof of authenticated shared admission. Railway staging also had a frontend
pinned to an older revision than its socket. These are distinct concerns.
This review does not assert which status/location each user had during the test.

## Entry and visibility corrections

- The signed-out entry now offers a prominent shared-universe sign-in link and
  labels the local launch as **OFFLINE SOLO FLIGHT**.
- An authenticated main hangar launch refuses a client build with shared flight
  disabled instead of silently substituting offline flight.
- All streamed non-own human ships and AI patrols receive in-world designation
  labels explicitly identifying **HUMAN PILOT** versus **AI PATROL**.
- An optional **NEARBY PILOTS** disclosure shows server-received human and AI
  contacts, allegiance, range, life state and current region. It is not a global
  account roster. It clears/hides unconfirmed contacts during reconnect or stale
  snapshots and never reveals account identities.
- Different server-verified locations still use different spatial sessions.
  No teleport, faction-room duplication or global exact-position broadcast was
  added to make a presence test appear successful.

## Bounded automatic AI assistance

`ORBITAL_FREE_FLIGHT_FRIENDLY_AI=true` enables the server's automatic defender
response. It is enabled for Development; staging/Production are not implicitly
changed by this work.

One defender per faction is shared across that faction's active encounters in a
spatial session. The server admits it as an allied NPC, flies it through the
existing 3D simulation, and resolves its projectiles against the same enemies.
Enemy patrols can target and damage the defender. A destroyed defender is not
automatically healed or respawned. Turning the feature off stops its firing.

Defenders have no player account and are never added to the human participant
set. Their final blows do not become fabricated human kills. Their membership,
health and actor identity persist in the versioned session checkpoint; older
checkpoints without allied membership remain readable.

This is bounded in-session assistance, not a completed global 80/20 population
balancer, strategic fleet scheduler, autonomous unattended fleet war, or a
certification that every allied fleet in every region reinforces every battle.

## Verification and rollout

Regression tests cover real AI weapon emission, physical hull damage and enemy
destruction without directly changing target health, existing two-pilot
kills/assists, opening/reconnect behavior, shared-owner routing and presence
classification. Keep source tests separate from live authenticated proof.

For the next staging rollout, align the frontend, API and socket revisions,
enable the friendly-AI gate only on the intended socket service, and verify
two distinct authenticated pilots at the same canonical location. Confirm
reciprocal HUMAN markers and presence, then AI reinforcement in their actual
shared battle. A healthy socket alone cannot certify this flow.
