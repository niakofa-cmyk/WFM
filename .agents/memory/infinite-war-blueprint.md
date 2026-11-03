---
name: WFM Infinite War blueprint
description: The owner's primary product vision for connected open-universe combat, competitive warfronts, and staged expansion.
---

The owner's complete 772-line blueprint is preserved at
`attached_assets/Pasted-WAR-FOR-MARS-The-Infinite-War-Open-Universe-Multiplayer_1793690415379.txt`.
The project-facing summary and implementation interpretation are in
`docs/references/wfm-infinite-war-blueprint.md`.

The defining principle is: **“The universe is the battlefield. Every
competitive engagement is an operation within the larger war. Every operation
can have consequences for the universe.”** This is WFM's primary product
direction. Exploration, real-time combat, competitive warfare, cooperative
operations, and persistent faction conflict should become one coherent
experience rather than disconnected modes.

The blueprint's proposed end state includes targetable combat with distinct
faction and ship capabilities; server-validated damage and destruction;
5v5 warfronts entered from shared sectors; later tournaments and larger
instanced battles; connected authored/procedural sectors; synchronized
anomalies such as gravity wells and wormholes; and validated consequences for
the persistent war. Its 10-section roadmap orders this work from combat
foundation and ship identity through shared 5v5, universe integration,
warfronts, competitive systems, connected sectors, anomalies, fleet warfare,
and broader galactic expansion. The full source's acceptance criteria and
“not yet” list are part of the blueprint, not optional implementation details.

**Why:** the owner explicitly designated this document as WFM's foremost
blueprint. It also states that ambitious capacities are goals, advises against
simulating an actually infinite galaxy or hundreds of ships at once, and
requires server authority for competitive outcomes.

**How to apply:** treat this as the north-star for product decisions, then
deliver it as small, playable, testable slices. Preserve an expandable,
connected-sector model rather than promising an infinitely simulated world.
Make competitive engagements occur in universe locations and connect their
results to war state only through validated, idempotent server logic. Keep
current implemented features, verified releases, and proposed future goals
clearly distinct. Keep matchmaking, simulation, damage, subsystem failure,
mission outcomes, and rewards server-authoritative; do not accept
client-controlled damage, results, or economy settings. Use feature flags and
separate Development/Staging/Production configuration for incomplete systems.
Before expanding player counts, visual effects, or network rates, verify
determinism, reconnection, security, and target-device performance. Existing
auth, data-preservation, reward, and release safety boundaries continue to
apply.

Current code is a partial foundation, not completion of the blueprint:
Rust Disc flight and Iron Eclipse co-op are separate from the 5v5 Wing
matchmaking/arena. The open-universe and competitive modes are not yet joined
into one persistent warfront. Larger match sizes, tournaments, synchronized
cosmic anomalies, and persistent territory consequences remain future work.
