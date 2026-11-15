---
name: Spacecraft visual foundation
description: User's fleet art direction and staged scope for Orbital hull development.
---

The user's spacecraft and fleet references are retained in:
- `attached_assets/Pasted--WAR-FOR-MARS-INFINITE-WAR-ORBITAL-COMBAT-LAB-MASTER-SP_1793924339098.txt`
- `docs/infinite-war/SPACECRAFT-FLEET-FORENSIC-AUDIT.md`
- `attached_assets/Pasted--WAR-FOR-MARS-INFINITE-WAR-ORBITAL-COMBAT-LAB-MASTER-SP_1793917569394.txt`
- `attached_assets/Pasted-WFM-Forensic-spacecraft-and-fleet-evaluation-I-inspecte_1793917662770.txt`
- `attached_assets/Screenshot_20261105-163953_1793918498147.png`
- `attached_assets/Screenshot_20261105-163938_1793918498196.png`
- `attached_assets/Screenshot_20261105-163930_1793918498213.png`
- `attached_assets/Screenshot_20261105-163921_1793918498231.png`
- `attached_assets/Screenshot_20261105-163559_1793918498250.png`
- `attached_assets/Screenshot_20261105-163622_1793918498269.png`
- `attached_assets/Screenshot_20261105-163637_1793918498287.png`
- `attached_assets/Screenshot_20261105-163648_1793918498305.png`

**Rule:** Preserve the identities, names, factions, and established roles of the original eight selectable ships. The planned fighter roster is four additional specialists per faction: USSF Wasp, Valiant, Aegis, Bastion; Accord Apep, Sekhmet, Garuda, Vajra. USSF should read as disciplined, modular military construction with blue identification; Accord should use warm bronze/amber, unconventional, radial, and energy-driven forms. Keep ship identity, weapon fit, and ability mechanical rather than purely decorative. Visual-only geometry must not imply changed simulation stats or collision. Keep multiplayer effects server-authoritative and versioned. Preserve Orbital v1-v4 replay behavior; v4 adds specialist AI wings and role-based formation behavior, while v5 rotates AI lineups deterministically so all specialists appear in default matches. Keep the opt-in co-op sector contract independent of combat-runtime version changes. The latest spacecraft-and-fleet directive orders work from a repository-backed audit through reusable weapons, missiles/countermeasures, fleet AI, capital systems, multiplayer and mobile certification; current evidence and phase status are in `docs/infinite-war/SPACECRAFT-FLEET-FORENSIC-AUDIT.md`.

**Why:** The user asked to retain the current roster while substantially improving the actual 3D construction, then approved the supplied eight-ship specialist expansion. The default v4 enemy lineup sampled only five of eight hulls, so some specialists were routinely absent from AI matches. Scripted AI matchup results are not sufficient evidence for changing ship statistics, and rule changes must not alter already-issued replay outcomes.

**How to apply:** Treat the attached master directive and forensic evaluation as the source references. Keep the shared Orbital model builder within the existing renderer path, mobile-conscious, and separate from simulation rules. Preserve the original eight IDs and saved loadouts when extending the catalog. Add mechanics and regression tests for weapons and abilities; do not describe decorative hardpoints, damage states, or animations as functional until they have tested behavior. Version roster/AI changes, retain historical outcomes, and test lineup coverage across deterministic seeds. Do not change base ship stats based only on scripted AI matchups; require representative human 5v5 evidence. Keep the opt-in co-op sector contract version separate from combat-only runtime releases.
