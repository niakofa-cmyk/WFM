# WAR FOR MARS — Eight-Ship Certification

**Status: MEASURED; BALANCE GATE NOT PASSED.**

The harness now measures every ship using repeatable combat, mobility, and ability drills. The results identify outliers, so they do not support a claim that all eight ships are balanced yet.

## Provenance

- Source commit: `87625e57b125fc565ecdb942d46681a6044960c3`
- Run date: 2026-10-20
- Command: `pnpm --filter @workspace/api-server run certify:ships -- --seeds=5 --seed-offset=5`
- Seed cohort: 5–9; five fixed seeds per matchup
- Coverage: 16 cross-faction ship pairs, both seat orientations, 160 duels and 40 appearances per ship per cohort; plus five full 5v5 AI Strikes per ship per cohort
- Duel cap: 360 seconds

## Method

- Each Accord ship is matched against each USSF ship. Each matchup is mirrored so both ships take the player seat, using the same seed in both orientations.
- A standardized scripted pilot flies each side with velocity-led aim, the same approach/turn/fire policy, a lock opportunity for lock-capable ships, zero refit, no teammates, and no map rocks. Class abilities trigger at fixed range or health conditions.
- The harness also runs five full 5v5 Strike simulations per ship on the dust field. All ten seats use the production AI, with the focal ship in the player slot; the runs include rocks, objectives, and respawns.
- Damage comes from landed-hit events. First-life survival is capped at the match duration for ships that do not die; alive percentage includes respawn downtime.
- Movement is measured in a separate acceleration/turn probe. Each ability is measured in a controlled drill; effects are not reduced to damage when the ability is defensive or tactical.
- Results by role are exact matchups against the current opposing-faction roster. Each role is represented by one ship, not a statistically broad role sample.

## Results — seed cohort 5–9

| Ship / role | W-D-L | Score rate* | Damage dealt / received per duel | First life / time alive | Acceleration / handling probe | Battle distance | Battle turn | Ability drill |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Mandjet (Vanguard) | 30-0-10 | 75.0% | 2221.1 / 1444.1 | 94 s / 96% | 0.63 s to 90%; 11.9 m in 1 s; 66.1°/s | 356 m/min | 27.0°/s | Solar Flare: 36.0 forward-cone damage at 12 m; 8 s cooldown |
| Shakuna (Hunter) | 21-5-14 | 58.8% | 1388.8 / 769.9 | 188 s / 97% | 0.63 s to 90%; 23.8 m in 1 s; 162.3°/s | 675 m/min | 43.5°/s | Wing Dive: 18.0 measured ram damage; 18 ram power; 0.48 s boost; 7 s cooldown |
| Sundara (Striker) | 20-0-20 | 50.0% | 1788.4 / 752.7 | 104 s / 95% | 0.65 s to 90%; 15.7 m in 1 s; 102.2°/s | 469 m/min | 33.9°/s | Vortex Camouflage: 4.00 s cloak; 53.9 next-shot damage; 10 s cooldown |
| Tripura (Support) | 14-0-26 | 35.0% | 1101.5 / 1333.2 | 92 s / 96% | 0.60 s to 90%; 13.5 m in 1 s; 90.2°/s | 377 m/min | 29.4°/s | Trinity Shift: 1.15 s thrust root at 12 m; 11 s cooldown |
| Duskbreaker (Striker) | 15-0-25 | 37.5% | 1265.7 / 1512.9 | 88 s / 93% | 0.60 s to 90%; 17.8 m in 1 s; 114.2°/s | 491 m/min | 33.9°/s | Quantum Lock: 1.50× damage for 3.2 s; 6.6 first-shot damage; 11 s cooldown |
| Sentinel-G (Support) | 30-5-5 | 81.3% | 1001.0 / 2366.1 | 317 s / 98% | 0.65 s to 90%; 11.1 m in 1 s; 84.2°/s | 304 m/min | 27.7°/s | Proximity Ward: restored 75.0 shield; 0.80 s guard; 12 s cooldown |
| Splitter Ring (Hunter) | 10-0-30 | 25.0% | 1054.0 / 1546.4 | 77 s / 92% | 0.60 s to 90%; 17.0 m in 1 s; 120.3°/s | 473 m/min | 33.6°/s | Ring Split: 3.20 s target jam; 9 s cooldown |
| Glide Knife (Raider) | 15-0-25 | 37.5% | 979.2 / 1074.3 | 123 s / 93% | 0.67 s to 90%; 21.7 m in 1 s; 138.3°/s | 643 m/min | 41.0°/s | Skip Reentry: 42.0 measured ram damage; 1.15 s untargetable and boost; 12 s cooldown |

*Score rate counts a draw as half a win. First-life time is capped at 360 seconds; alive percentage includes time after respawn.

## Full 5v5 Strike — production AI

Each cohort contains five full matches per ship. All ten seats use the production AI; the focal ship occupies the player slot.

| Focal ship / role | Cohort 0–4 W-D-L (score) | Cohort 5–9 W-D-L (score) | Alive time, cohort 5–9 | Relay lead, cohort 5–9 |
| --- | ---: | ---: | ---: | ---: |
| Mandjet (Vanguard) | 0-5-0 (50%) | 1-3-1 (50%) | 100% | 0.00 |
| Shakuna (Hunter) | 1-0-4 (20%) | 1-3-1 (50%) | 100% | -0.40 |
| Sundara (Striker) | 1-2-2 (40%) | 2-1-2 (50%) | 100% | -0.40 |
| Tripura (Support) | 3-2-0 (80%) | 3-2-0 (80%) | 100% | 0.00 |
| Duskbreaker (Striker) | 0-5-0 (50%) | 0-5-0 (50%) | 100% | 0.20 |
| Sentinel-G (Support) | 1-2-2 (40%) | 2-0-3 (40%) | 99% | -1.00 |
| Splitter Ring (Hunter) | 0-2-3 (20%) | 0-5-0 (50%) | 100% | 0.20 |
| Glide Knife (Raider) | 0-0-5 (0%) | 3-1-1 (70%) | 99% | 0.40 |

These two small AI-vs-AI cohorts vary substantially for Shakuna, Splitter Ring, and Glide Knife. Most focal seats stayed alive for the full match, and these outcomes do not override the 1v1 flags or establish human balance. The production AI does not activate ultimates; treat this as full-engine smoke coverage, not a competitive balance gate.

## Results by opposing role

| Ship | Vanguard | Hunter | Striker | Support | Raider |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mandjet | — | 10-0-0 (100%) | 10-0-0 (100%) | 0-0-10 (0%) | 10-0-0 (100%) |
| Shakuna | — | 10-0-0 (100%) | 5-0-5 (50%) | 0-5-5 (25%) | 6-0-4 (60%) |
| Sundara | — | 5-0-5 (50%) | 5-0-5 (50%) | 5-0-5 (50%) | 5-0-5 (50%) |
| Tripura | — | 5-0-5 (50%) | 5-0-5 (50%) | 0-0-10 (0%) | 4-0-6 (40%) |
| Duskbreaker | 0-0-10 (0%) | 5-0-5 (50%) | 5-0-5 (50%) | 5-0-5 (50%) | — |
| Sentinel-G | 10-0-0 (100%) | 5-5-0 (75%) | 5-0-5 (50%) | 10-0-0 (100%) | — |
| Splitter Ring | 0-0-10 (0%) | 0-0-10 (0%) | 5-0-5 (50%) | 5-0-5 (50%) | — |
| Glide Knife | 0-0-10 (0%) | 4-0-6 (40%) | 5-0-5 (50%) | 6-0-4 (60%) | — |

Cells show W-D-L and score rate. A dash means the opposing faction does not field that role.

## Balance review

The review band is 40–60% overall score after at least 40 appearances. Any opposing-role matchup below 35% or above 65% with at least 10 samples is also flagged. Same-role damage is reviewed when it differs from the median by more than 25%.

**Overall flags in cohort 5–9:** Mandjet 75%, Tripura 35%, Duskbreaker 38%, Sentinel-G 81%, Splitter Ring 25%, Glide Knife 38%.

**Stability check:** cohort 0–4 repeated the flags for Mandjet, Tripura, Duskbreaker, Sentinel-G, and Splitter Ring. Glide Knife was exactly 40% in that cohort and 37.5% in cohort 5–9, so it is at the review boundary. Sundara remained at 50% in both cohorts. This confirms repeatable model signals, not human-match balance.

No balance-tuning change from this certification was retained in the game build. An early harness version omitted lock opportunities and reported Sundara at 0%; after correcting the pilot to use target lock and lead with observed movement, Sundara measured 50% in both cohorts. This is why the current diagnostic is not being used to auto-nerf ships. The final results still flag Mandjet and Sentinel-G on the high side and Tripura, Duskbreaker, Splitter Ring, and sometimes Glide Knife on the low side; these require human 5v5 confirmation before numeric tuning.

## Balancing process

1. Use the benchmark to identify an outlier; do not make a numeric change from one matchup cell alone.
2. Change one ship stat or ability parameter per iteration, keeping client and server definitions in sync.
3. Rerun at least five previously unused seeds with `--seed-offset` and compare overall rate, opposing-ship matchups, damage, survival, and ability results.
4. Confirm promising changes in a human 5v5 playtest before accepting the balance change. Retain the prior value if the change only improves the scripted 1v1 score while harming role identity or team usefulness.
5. Update this report with the source commit, new cohort, and human evidence.

## Limits and disposition

The 1v1 runs are scripted-pilot diagnostics; the 5v5 runs are AI-vs-AI and the production AI does not use ultimates. Neither is a human 5v5 result or proof that every ship feels equally useful. The 1v1 results show repeatable outliers, so **the eight-ship balance gate remains open** pending human team playtests and follow-up tuning. The role table has one representative ship per opponent role, so its cells are exact ship pairings.
