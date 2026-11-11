# Orbital combat intelligence and kill recovery

## Owner direction and retained reference

Enemy pilots should seek rear-quarter firing positions, evade incoming attacks,
and employ guns and missiles through the same physical simulation as pilots.
Destroying a hostile should automatically restore maneuver energy and contribute
to meaningful kill milestones while exploration continues in the same universe.

The complete upload is retained verbatim at
`references/ORBITAL-COMBAT-INTELLIGENCE-AND-KILL-PROGRESSION.source.txt`.
Its repository observations, linked commits and proposed modules are historical
reference material, not an assertion that every proposed feature exists.

## Implemented foundation

### Server flight intelligence

- Recalculate a rear-quarter interception point using target orientation,
  velocity and bounded prediction time.
- Give squad ships different lateral/elevation approach slots.
- Reach those positions through ordinary yaw, pitch, thrust and integration;
  never teleport or grant speed/damage bonuses.
- Observe actual hostile projectiles, estimate closest approach and react only
  to incoming trajectories within a bounded time horizon.
- Apply a short lateral/vertical/roll dodge with energy eligibility and a
  cooldown. Boost consumes normal flight energy; evasion grants no immunity.
- Preserve aim-before-fire and normal lock, ammunition, cooldown and collision
  checks. Stagger missile opportunities to avoid synchronized instantaneous
  squad volleys.
- Critically damaged ships without a firing solution attempt withdrawal.

This is a deterministic tactical foundation, not machine learning, long-term
adaptation, full fleet command or a certified human difficulty balance.
Friendly combat defenders use the same physical decision path.
Combat remains in the existing shared-flight runtime; training, competitive
Wing rules and reward-adjudicated replay kernels are not replaced.

### Automatic per-kill resource recovery

Only an actual accepted server projectile destruction of a reserved hostile
patrol ship qualifies. A living human attacker receives:

| Destruction | Maneuver energy |
| --- | --- |
| Fighter | +20 points |
| Heavy/siege hull | +30 points |
| Consecutive kills 5, 10, 15 or 20 | Additional +10 points and 10% maximum-shield resupply |

Energy is capped at 100. Shield resupply is capped at the hull's maximum shield.
These are resource refills, not permanent weapon/shield-stat upgrades or full
repairs. No ammo, currency, XP, abilities or faction reputation are minted by
this path. Existing encounter credit settlement remains unchanged.

AI kills, friendly destruction, mere attendance, client reward claims and assists
do not grant this final-blow energy reward. Assist energy is a separate proposal
in the source, not enabled here. AI still may contribute to shared combat.

Dead ships are excluded from further damage/recovery; checkpointed corpse,
encounter and actor state prevent a restore from repeating a destruction
reward. Energy is applied immediately at confirmed impact, separately from
later database currency settlement.

Encounter checkpoints now retain actual per-actor hull values separately from
the immutable starting roster. This preserves partial damage and the destroyed
patrol roster needed to reproduce finalized receipts. Older human-attributed
death records can reconstruct those deaths; unverifiable receipt fingerprints
still fail closed. No reward fingerprint validation is disabled.

### Streaks, synchronization and presentation

- Confirmed kill count, current streak and best streak are server actor state.
- Pilot destruction resets current streak while preserving the disabled actor's
  confirmed count and best. Returning to the hangar and creating a replacement
  actor starts a new flight record; account-lifetime totals are not implemented
  by this actor-local system.
- Existing session checkpoints retain this state and resource values when a
  checkpoint store is configured. Older checkpoints without progress start at
  zero. This is not a new account-wide lifetime achievement ledger.
- An additive `freeflight_combat_progress` packet, protocol `1`, carries only
  the authenticated viewer's actor/session/tick, absolute energy, progress,
  restored energy, milestone and reason (`sync` or `kill`).
- The client validates bounds, identity, session and nondecreasing tick before
  using absolute server energy. It never adds a packet's energy delta locally.
- Regular sync packets repair drift and restore the display after reconnect.
  Kill/milestone messages use the existing compact flight notification and
  energy badge; no additional battlefield information box is introduced.
- Existing snapshot schemas remain unchanged. Older clients ignore the
  additive packet; newer clients remain usable with older servers.

## Evidence and rollout boundaries

Automated coverage measures real integrated arrival at a rear-quarter position,
real dodge displacement/energy use, faction/threat filtering, cooldowns, missile
eligibility, recovery caps, exact milestone thresholds and client packet bounds.
The two-pilot combat check requires actual server hits, one kill plus one assist,
one recovery grant, continued flight, checkpoint restoration and no repeated
energy grant after restore. Its simulated authority and flight clocks advance
together, and its test pilot aims in three dimensions.

These checks are not an authenticated two-phone combat test, a production
balance certification or proof that the current process-local Development
runtime has durable persistence enabled. Production and staging infrastructure
are untouched.

Deferred proposals from the upload: account-lifetime medals and unlocks,
transactional achievement/XP ledgers, assist energy, NPC experience tiers,
capital-subsystem rewards, adaptive learning, deeper squad target assignment
and human multiplayer difficulty/balance certification. None is advertised as
complete merely because the reference document describes it.
