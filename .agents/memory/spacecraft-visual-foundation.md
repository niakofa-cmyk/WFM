---
name: Spacecraft visual foundation
description: User's fleet art direction and staged scope for Orbital hull development.
---

The user's spacecraft and fleet references are retained in:
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

**Rule:** Preserve the identities, names, factions, and established roles of the original eight selectable ships. The planned fighter roster is four additional specialists per faction: USSF Wasp, Valiant, Aegis, Bastion; Accord Apep, Sekhmet, Garuda, Vajra. USSF should read as disciplined, modular military construction with blue identification; Accord should use warm bronze/amber, unconventional, radial, and energy-driven forms. Keep ship identity, weapon fit, and ability mechanical rather than purely decorative. Visual-only geometry must not imply changed simulation stats or collision. Keep multiplayer effects server-authoritative and versioned.

**Why:** The user asked to retain the current roster while substantially improving the actual 3D construction, then approved the supplied eight-ship specialist expansion. The forensic review also found that old special-ability labels were not proof that Orbital executed them; a canonical Orbital ability path must work before expanding further.

**How to apply:** Treat the attached master directive and forensic evaluation as the source references. Keep the shared Orbital model builder within the existing renderer path, mobile-conscious, and separate from simulation rules. Preserve the original eight IDs and saved loadouts when extending the catalog. Add mechanics and regression tests for weapons and abilities; do not describe decorative hardpoints, damage states, or animations as functional until they have tested behavior.
