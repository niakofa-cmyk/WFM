---
name: Component-based ship combat direction
description: Why disabled ship systems must be distinct from hull destruction and rewards.
---

Ships should be military assemblies with independently damageable propulsion,
weapons, shields, sensors, communications, power and command systems. Allied
humans and AI should be able to coordinate attacks on different vulnerabilities
inside the same continuous Orbital universe.

**Why:** The creator explicitly requested component destruction as a richer
alternative to several pilots shooting one large health bar. A crippled enemy
can remain alive and dangerous; surrender, capture and boarding are opportunities
only if their actual gameplay is supported.

**How to apply:** Use server-confirmed physical hits, retain damaged systems
through recovery, and never treat a component disable as a kill or reward claim.
Extend existing shared flight, not normalized competition or a parallel battle
runtime. See `docs/infinite-war/SHIP-SUBSYSTEM-COMBAT.md` for implementation scope
and explicit unsupported behaviors.
