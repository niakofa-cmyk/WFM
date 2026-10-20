# WAR FOR MARS — Eight-Ship Certification

**Status: DIAGNOSTIC ONLY — balance gate not passed.**

The benchmark is repeatable, but the simulator stores lock and homing state on the player match. The focal pilot therefore has capabilities that the scripted opponent cannot use. The numbers below are useful for regression and outlier triage, not for declaring a balanced roster.

## Provenance

- Tested source commit: recorded in `TEST-REPORT.md` after the verification commit
- Run date: 2026-10-20
- Command: `pnpm --filter @workspace/api-server run certify:ships -- --seeds=20 --seed-offset=50`
- Seed cohort: 50–69; 20 fixed seeds per matchup
- Coverage: 16 cross-faction ship pairs, each ship scored as focal pilot; 640 six-minute-cap duels and 80 appearances per ship; 20 full AI 5v5 Strikes per ship
- Duel cap: 360 seconds

## Method and limits

- Every Accord ship was tested against every USSF ship. Each ship was measured as the controlled focal pilot in its own player-seat trial; only that focal result is counted.
- Both scripted pilots use velocity-led aim, the same fire/turn policy, zero refit, no teammates, no map rocks, and class-specific ability triggers at fixed range or health conditions.
- The duel harness equalizes shield regeneration at 5 points per second and uses a symmetric 9-point integrity loss per death. These are benchmark-only settings; normal game defaults remain unchanged.
- **Lock/homing limitation:** lock state is player-seat-only in the current simulator. The opponent cannot use equivalent lock or homing behavior. Do not use these 1v1 rates as fair head-to-head balance evidence for lock-capable ships until lock state is per-craft.
- The full 5v5 simulations use production AI in all ten seats, include rocks/objectives/respawns, and do not activate ultimates. They are AI diagnostics, not human team-play evidence.
- Damage is summed from landed-hit events; first-life survival is capped at 360 seconds for pilots that survive; alive percentage includes respawn downtime. Movement is measured in a separate throttle/turn probe.
- Ability effects are measured in a stationary-target drill. The role table maps each role to one specific opposing ship, not a broad role sample. Splitter Ring’s jam is currently represented as AI steering disruption, not as a human control effect.

## Results — seed cohort 50–69

| Ship / role | W-D-L | Score rate* | Avg damage dealt / received | First life / time alive | 0–90% speed / turn probe | Battle distance | Battle turn | Ability drill |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Mandjet (Vanguard) | 60-0-20 | 75.0% | 2221.2 / 1209.4 | 72 s / 96% | 0.63 s to 90%; 11.9 m in 1 s; 66.1°/s | 357 m/min | 27.1°/s | Solar Flare: 36.0 measured forward-cone damage at 12 m; 8 s cooldown |
| Shakuna (Hunter) | 60-1-19 | 75.6% | 1560.6 / 689.7 | 139 s / 97% | 0.63 s to 90%; 23.8 m in 1 s; 162.3°/s | 686 m/min | 43.6°/s | Wing Dive: 18.0 measured ram damage; 18 ram power; 0.48 s boost; 7 s cooldown |
| Sundara (Striker) | 80-0-0 | 100.0% | 2417.1 / 306.0 | 154 s / 100% | 0.65 s to 90%; 15.7 m in 1 s; 102.2°/s | 503 m/min | 34.9°/s | Vortex Camouflage: 4.00 s cloak; 53.9 measured next-shot damage; 10 s cooldown |
| Tripura (Support) | 28-18-34 | 46.3% | 1187.1 / 1157.9 | 72 s / 96% | 0.60 s to 90%; 13.5 m in 1 s; 90.2°/s | 381 m/min | 29.6°/s | Trinity Shift: 1.15 s thrust root at 12 m; 11 s cooldown |
| Duskbreaker (Striker) | 56-4-20 | 72.5% | 1509.9 / 1143.5 | 130 s / 95% | 0.60 s to 90%; 17.8 m in 1 s; 114.2°/s | 495 m/min | 34.6°/s | Quantum Lock: 1.50× damage for 3.2 s; 6.6 measured first-shot damage; 11 s cooldown |
| Sentinel-G (Support) | 80-0-0 | 100.0% | 1133.3 / 1856.7 | 360 s / 100% | 0.65 s to 90%; 11.1 m in 1 s; 84.2°/s | 310 m/min | 28.2°/s | Proximity Ward: restored 75.0 shield; 0.80 s guard; 12 s cooldown |
| Splitter Ring (Hunter) | 38-8-34 | 52.5% | 1278.0 / 1340.5 | 119 s / 95% | 0.60 s to 90%; 17.0 m in 1 s; 120.3°/s | 476 m/min | 34.1°/s | Ring Split: 3.20 s target jam; 9 s cooldown |
| Glide Knife (Raider) | 60-0-20 | 75.0% | 1221.2 / 961.2 | 163 s / 96% | 0.67 s to 90%; 21.7 m in 1 s; 138.3°/s | 646 m/min | 41.2°/s | Skip Reentry: 42.0 measured ram damage; 1.15 s untargetable; 1.15 s boost; 12 s cooldown |

*Score rate counts a draw as half a win. Damage is per duel. First-life survival is capped at 360 seconds; alive percentage includes time after respawn.

## Full 5v5 Strike — production AI

Each ship has 20 full matches in this combined cohort.

| Focal ship / role | W-D-L | Score rate | Focal-seat alive time | Average relay lead at end |
| --- | ---: | ---: | ---: | ---: |
| Mandjet (Vanguard) | 1-17-2 | 47.5% | 100% | 0.40 |
| Shakuna (Hunter) | 7-4-9 | 45.0% | 100% | -0.55 |
| Sundara (Striker) | 8-3-9 | 47.5% | 100% | -0.35 |
| Tripura (Support) | 6-11-3 | 57.5% | 100% | 0.35 |
| Duskbreaker (Striker) | 1-15-4 | 42.5% | 100% | -0.05 |
| Sentinel-G (Support) | 6-6-8 | 45.0% | 100% | 0.00 |
| Splitter Ring (Hunter) | 2-14-4 | 45.0% | 100% | -0.10 |
| Glide Knife (Raider) | 13-0-7 | 65.0% | 100% | 0.05 |

These are AI-vs-AI results; they are not human 5v5 outcomes and the production AI does not use ultimates.

## Results by opposing role

| Ship | Vanguard | Hunter | Striker | Support | Raider |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mandjet | — | 20-0-0 (100%) | 20-0-0 (100%) | 0-0-20 (0%) | 20-0-0 (100%) |
| Shakuna | — | 20-0-0 (100%) | 20-0-0 (100%) | 0-1-19 (3%) | 20-0-0 (100%) |
| Sundara | — | 20-0-0 (100%) | 20-0-0 (100%) | 20-0-0 (100%) | 20-0-0 (100%) |
| Tripura | — | 20-0-0 (100%) | 8-11-1 (68%) | 0-0-20 (0%) | 0-7-13 (18%) |
| Duskbreaker | 0-0-20 (0%) | 16-4-0 (90%) | 20-0-0 (100%) | 20-0-0 (100%) | — |
| Sentinel-G | 20-0-0 (100%) | 20-0-0 (100%) | 20-0-0 (100%) | 20-0-0 (100%) | — |
| Splitter Ring | 0-0-20 (0%) | 0-6-14 (15%) | 20-0-0 (100%) | 18-2-0 (95%) | — |
| Glide Knife | 0-0-20 (0%) | 20-0-0 (100%) | 20-0-0 (100%) | 20-0-0 (100%) | — |

Each role maps to one opposing-faction ship, so each cell is an exact matchup rather than a broad role sample. The lock/homing limitation above applies to these results.

## Review and provisional tuning trials

- Review threshold: overall score below 40% or above 60% after at least 40 appearances; role matchup below 35% or above 65% with at least 10 samples; same-role damage more than 25% from the median.
- Diagnostic overall flags: Mandjet 75%, Shakuna 75.6%, Sundara 100%, Duskbreaker 72.5%, Sentinel-G 100%, and Glide Knife 75%. Tripura (46.3%) and Splitter Ring (52.5%) do not repeat the earlier low-outlier signal under the corrected method.
- Two Sentinel-G changes were tested one at a time on the same two seed cohorts and reverted: Ward cooldown 12→14 seconds and shield 150→135. Neither changed the 80-0-0 W-D-L or 360-second first-life survival; incoming damage shifted by less than 2%. No ship-stat change is retained.
- This result is not evidence that the listed ships are overpowered. Do not tune from this harness until per-craft lock/homing is represented symmetrically and the candidate is checked in human 5v5.

## Balancing process and disposition

1. Treat this harness as a regression/outlier diagnostic only.
2. Before balance tuning, implement independent lock state for each pilot and ensure the scripted opponent can use equivalent controls.
3. Change one ship stat or ability parameter at a time, keeping client and server definitions in sync.
4. Compare a fresh seed cohort and role/damage/survival/ability metrics, then validate candidates in human 5v5 before accepting a change.

The eight-ship balance gate remains open. No human 5v5 certification was performed. Android Chrome/iOS Safari, frame rate, memory, thermal behavior, and full six-minute phone play remain untested; see `MOBILE-CERTIFICATION.md`.
