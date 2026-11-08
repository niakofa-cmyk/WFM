# Implementation follow-through

The entry/recovery findings below are the historical audit baseline.
[Opening, Hangar and Recovery](OPENING-HANGAR-AND-RECOVERY.md) records the
subsequent implementation and its remaining verification/persistence limits;
do not treat these original findings as proof that the fixes were deployed.

# Training-to-shared-flight and recovery audit

## Scope and evidence

Source review following authenticated staging verification of runtime
`26ade0c`. This is an implementation audit, not certification of successful
two-pilot battle settlement. No runtime, schema, staging flag or Production
change is made by this document.

Both staging accounts authenticated. Observed reconnects supplied seven moving
fleet models and four hostiles each. Both pilots were already destroyed before
instrumented firing. No player kill, assist or completed settlement was observed.
See the root staging report and JSON results for exact evidence.

## Entry: the current default bypasses the intended hangar launch

`App.tsx` resolves the primary boot to Orbital. `WarApp.tsx` initializes
`orbitalUniverseOpen` through `enterOrbitalOnAccountBoot` in `wfm-boot.ts`.
For a primary account entry without the chart or a room invite, this returns
true. Once the verified world anchor is available, Arena can mount and join
shared flight without a fresh press of the hangar's Enter Universe button.

This explains how an ordinary post-sign-in redirect can open a live flight
socket before a test driver starts inspecting gameplay. It does not establish
the exact time or cause of each pilot's death.

Scout acquisition occurs within 520 m and pursuit can bring a patrol into the
existing 180 m automatic engagement envelope. Automatic interception is intended;
starting an unattended flight during sign-in is not required to implement it.

Recommended correction: primary entry should show the operational hangar.
Only an explicit launch should mount shared flight. Preserve deliberate invite
and navigation contracts, verified location selection and server-owned combat.
Do not disable patrol interception or increase the encounter radius to conceal
the entry problem.

## Disabled-pilot recovery

- Reconnecting to the same server seat preserves zero hull and destroyed life.
  This is correct; a browser reload must not heal a ship.
- Arena displays RETURN TO HANGAR in status text, but its exit action is inside
  the pause menu, not an immediate disabled-state recovery button.
- The exit callback closes the local universe presentation. Server detach retains
  the actor for a 15-second disconnect grace period. Immediate same-loadout
  re-entry can therefore restore the destroyed actor.
- After that grace period, disconnected actor cleanup removes it. A later join
  can create a new craft; this is lifecycle cleanup, not an explicit,
  auditable recovery operation.
- The loadout/faction-change rejoin branch reconstructs the craft with full hull
  and shields at its old position, without an explicit alive/combat recovery
  restriction in that branch. This is a source-level inconsistency, not a
  tested staging exploit.

Recommended correction: specify one server-owned recovery lifecycle tied to a
verified installation, clear client feedback and an explicit return action.
Rejoin, loadout changes and disconnect expiry must not become alternate,
unvalidated repairs or duplicate rewards. Preserve any outstanding encounter
settlement rather than dropping reservations to make relaunch succeed.

## How much of training combat is actually shared?

| Capability | Training | Continuous shared flight | Assessment |
| --- | --- | --- | --- |
| Three.js presentation | Arena | Arena, with server traffic/effects | Same renderer surface; not a second visual engine |
| Orbital flight foundation | Orbital simulation through local match step | Server `integrateSpatialFlight`, client prediction | Shared primitives, different orchestration |
| Primary and missile behavior | Local match weapon simulation | Shared weapon catalogs, volley spawning, lock acquisition, missile guidance and swept collision helpers | Core mechanisms reused; not full behavioral parity |
| Enemy AI | Local training match AI | Server roaming patrol and encounter AI | Separate AI policy with pursuit/search memory |
| Combat authority | Local practice | Server admission, encounter ownership, life/damage and result handling | Deliberately different; local practice cannot settle multiplayer rewards |
| Kill/assist/reward path | Local practice totals, no shared-flight reward authority | Server attribution and settlement code plus client result/tally handling | Implemented code; authenticated kills/assists/settlement remain unverified |
| Tactical rolls/drift | Training supports additional local controls | Shared client suppresses unsupported drift/maneuver controls | Incomplete parity; requires a versioned authoritative contract |
| Countermeasures and special abilities | Training has local behavior/UI | Countermeasure intent is serialized, but shared runtime input/weapon processing does not apply that behavior; no complete training ability path | Not fully migrated; visible controls or serialized intent alone are insufficient |
| Obstacles | Local training collision environment | Shared integration currently supplies empty colliders | Flight collision parity intentionally absent, not a completed world collision system |
| Pause | Local simulation pauses | Server continues while local menu opens | Menu copy incorrectly labels shared flight as locally paused |
| Defeat/return | Finite local match lifecycle | Destroyed authoritative seat survives reconnect | Needs an explicit recovery lifecycle |
| Continued exploration | Finite training activity | Shared flight loop remains mounted around encounters | Architectural support exists; successful post-settlement flight not verified |

The correct description is **shared rendering and simulation building blocks
with a partially integrated authoritative open-flight combat loop**, not
“training fully copied” or “all multiplayer combat verified.”

## Recommended implementation order

1. Correct hangar-first entry and shared-flight menu messaging; provide a visible
   disabled-state return action without fabricating a repair.
2. Implement and test server-owned recovery, including active encounter,
   outstanding settlement, same-loadout rejoin and loadout-change cases.
3. Establish one authenticated living-pilot battle with observers attached
   before launch; verify actual shots, damage, kills/assists, durable settlement
   and continued flight. Then port missing training abilities through versioned
   server contracts and add world colliders with matched client prediction.

Keep Three.js as the primary renderer under the Orbital universe, existing
rollback paths and unchanged reward validation. No Production promotion follows
from this audit.
