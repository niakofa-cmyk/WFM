# Authenticated staging flight after simulation-parity repair

Status: **BLOCKED — the live replay was rejected; no reward was awarded**

Evidence recorded: `2026-10-26T11:32:40Z`.

## Tested source and scope

- Target: `https://wfm-app-staging-staging.up.railway.app/`
- Frontend source: `8886c9be94375f53507419af6bdd90e52728ae9d`
- Frontend deployment: `f4aec041-97e6-4959-a266-3ac828ff47ef` — Railway reports `SUCCESS`.
- API source: `09628b2c6721b722984651757800d45f5909e8fe`
- API deployment: `f2bda8ae-f639-4b41-8911-5efe9f948f5c` — Railway reports `SUCCESS`.
- The merged browser simulation is byte-identical to the API simulation.
- Only the isolated staging environment and an approved existing Development
  account were exercised. Production services, accounts, keys, and data were not changed.

## Verification completed before the claim

| Check | Result |
| --- | --- |
| Frontend automated tests | 25 passed, including simulation-parity regression |
| Frontend typecheck | Passed |
| Frontend production build | Passed |
| GitHub merged-source Workspace quality | Both recorded `Verify workspace` checks passed |
| GitHub staging-evidence gate | Failed/incomplete checks remain; not bypassed |
| Local frontend restart | Vite serving normally |
| Railway staging access gate | Access-code form unlocked the same staging browser context |
| Fresh Clerk sign-in | Successful; verification attempt HTTP 200 |
| Authenticated starting profile | HTTP 200; 90 credits |
| Normal flight | Arcade Skirmish, Mandjet, STRIKE 6:00 |
| Rendered graphics | WebGL2 context confirmed; screenshot shows active flight at 3:08 remaining |

The first waiting challenge did not establish a session after code submission.
That browser was closed without starting a flight or submitting a claim. A fresh
sign-in completed the later verification challenge successfully.

The navigation driver then treated multiple canvases as an error after Start
had already launched the match. Inspection recovered the same browser and run;
no replacement flight was created. The flight initially ran without keyboard
input during that inspection, then continued with ordinary keyboard movement,
turning, firing, targeting, and ability presses. No game-clock manipulation or
replay modification was used.

## First claim and persistence

| Check | Observed result |
| --- | --- |
| Client terminal result | Loss; 3 kills, 0 relays |
| Full recorded input sequence | 20,523 frames |
| Driver's ordinary control loop | 69 four-second cycles, following the initial idle/navigation inspection |
| Uncaught page errors | 0 recorded |
| Staging diagnostics | Enabled; server-issued config and complete inputs captured in browser memory |
| Raw pending replay in sessionStorage | Absent |
| First normal replay claim | HTTP 400: `The replay ended before the match was resolved.` |
| Fresh profile after rejection | HTTP 200; 90 credits unchanged |
| Rejected-claim retry | None |
| Accepted-claim duplicate test | Not performed: no claim was accepted |
| Reload | Authenticated profile HTTP 200; still 90 credits |
| Sign-out | Session cleared; profile HTTP 401 |
| Cleanup | Browser closed; no exported login state, credentials, raw replay, or full configuration persisted to files |

## In-memory replay comparison

The captured configuration and full input sequence were compared locally,
without modifying them or making another reward request. Input-shape validation
passed. Both comparisons used the canonical simulation source; the API copy at
its deployed source commit is byte-identical to the merged copy.

| Execution | Result |
| --- | --- |
| Actual deployed API claim | Incomplete replay, HTTP 400 |
| Local Node canonical simulation | Win after 9,984 frames; 2 kills, 3 relays |
| Standalone Chromium canonical simulation | Still unresolved after all 20,523 frames; 1 kill, 3 relays |
| Original live Arena | Loss after the recorded 20,523 frames; 3 kills, 0 relays |

Initial states matched in the inspected comparison. The first differing
compared state was after one tick: `allies[0].yaw`, absolute difference
`1.734723475976807e-18` between Node and Chromium.

This demonstrates a cross-runtime numerical reproducibility risk despite
identical source. It does **not** fully explain the additional difference
between the original live Arena and standalone Chromium, or establish the
complete cause of the deployed API rejection. Source equality remains a useful
regression guard, but is not runtime determinism certification.

No reward validation, frame limit, balance calculation, or duplicate protection
was weakened. The replay was not truncated, padded, or resubmitted.

## Remaining work

1. Establish a repeatable cross-runtime state comparison using the actual
   browser and deployed server runtimes, not two imports executing under Node.
2. Trace the first live-Arena versus standalone-browser state/input divergence.
   Preserve the distinction between actual applied input and recorded input,
   and compare the exact runtime configuration.
3. Repair the demonstrated reproducibility failures without trusting client
   outcomes or changing reward validation to accept an unresolved replay.
4. Only after that repair, obtain a newly authorized live flight with an
   accepted reward, test the identical accepted claim once, and verify the
   awarded balance after reload. None of those accepted-reward checks passed
   in this run.

## Release boundary

This is not Production authentication certification, Replit-native invite-only
deployment certification, physical-device performance certification, cross-device
persistence, account-isolation verification, or human multiplayer testing.
The four campaign sorties were not exercised in this pass. The broader
promotion gate remains pending.
