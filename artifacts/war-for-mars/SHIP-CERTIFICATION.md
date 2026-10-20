# WAR FOR MARS — Eight-Ship Certification

**Status: DIAGNOSTIC ONLY — balance gate not passed.**

The lock/homing asymmetry has been corrected: every craft owns its lock target, both teams can cycle locks, and homing bullets resolve targets on either side. The results below are now seat-symmetric scripted-pilot diagnostics, not human balance certification.

## Provenance

- Tested source commit: `7eae96dfb695f8658f452ca91e8d9c3b643bc2c3`
- Run date: 2026-10-20
- Command: `pnpm --filter @workspace/api-server run certify:ships -- --seeds=20 --seed-offset=50`
- Seed cohort: 50–69; 20 fixed seeds per matchup
- Coverage: 16 cross-faction ship pairs, each ship scored as focal pilot; 640 six-minute-cap duels and 80 appearances per ship; 20 full AI 5v5 Strikes per ship
- Duel cap: 360 seconds

## Method and limits

- Every Accord ship was tested against every USSF ship, and each ship was measured as the focal pilot in both directions of every matchup.
- Both scripted pilots use velocity-led aim, the same fire/turn/lock policy, zero refit, no teammates, no map rocks, and class-specific ability triggers at fixed range or health conditions.
- The duel harness equalizes shield regeneration at 5 points per second and uses a symmetric 9-point integrity loss per death. These are benchmark-only settings; normal game defaults remain unchanged.
- Per-craft lock acquisition, Duskbreaker auto-lock, and Sundara homing target resolution are available to both scripted pilots. Unit tests cover independent locks and homing from each team.
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
| Duskbreaker (Striker) | 36-4-40 | 47.5% | 1281.3 / 1633.0 | 42 s / 91% | 0.60 s to 90%; 17.8 m in 1 s; 114.2°/s | 502 m/min | 34.1°/s | Quantum Lock: 1.50× damage for 3.2 s; 6.6 measured first-shot damage; 11 s cooldown |
| Sentinel-G (Support) | 60-0-20 | 75.0% | 1027.2 / 2475.3 | 273 s / 97% | 0.65 s to 90%; 11.1 m in 1 s; 84.2°/s | 313 m/min | 27.9°/s | Proximity Ward: restored 75.0 shield; 0.80 s guard; 12 s cooldown |
| Splitter Ring (Hunter) | 18-8-54 | 27.5% | 1049.8 / 1555.7 | 31 s / 90% | 0.60 s to 90%; 17.0 m in 1 s; 120.3°/s | 483 m/min | 33.6°/s | Ring Split: 3.20 s target jam; 9 s cooldown |
| Glide Knife (Raider) | 40-0-40 | 50.0% | 975.5 / 1114.6 | 76 s / 91% | 0.67 s to 90%; 21.7 m in 1 s; 138.3°/s | 655 m/min | 41.0°/s | Skip Reentry: 42.0 measured ram damage; 1.15 s untargetable; 1.15 s boost; 12 s cooldown |

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

Each role maps to one opposing-faction ship, so each cell is an exact matchup rather than a broad role sample.

## Review and provisional tuning trials

- Review threshold: overall score below 40% or above 60% after at least 40 appearances; role matchup below 35% or above 65% with at least 10 samples; same-role damage more than 25% from the median.
- Diagnostic overall flags: Mandjet 75.0%, Shakuna 75.6%, Sundara 100.0%, Sentinel-G 75.0%, and Splitter Ring 27.5%. These are review flags, not balance conclusions.
- The corrected run materially changes Duskbreaker (72.5% to 47.5%) and Splitter Ring (52.5% to 27.5%) versus the earlier lock-asymmetric report; the old scores should not be compared as if the methods were equivalent.
- Do not tune from this harness alone. Human-versus-human and human-versus-AI matches are still required before accepting any balance change.

## Balancing process and disposition

1. Treat this harness as a regression/outlier diagnostic only.
2. Per-pilot lock and homing are now symmetric in the simulation; retain the regression tests when changing targeting or abilities.
3. Change one ship stat or ability parameter at a time, keeping client and server definitions in sync.
4. Compare a fresh seed cohort and role/damage/survival/ability metrics, then validate candidates in human 5v5 before accepting a change.

The eight-ship balance gate remains open. No human 5v5 certification was performed. Android Chrome/iOS Safari, frame rate, memory, thermal behavior, and full six-minute phone play remain untested; see `MOBILE-CERTIFICATION.md`.
