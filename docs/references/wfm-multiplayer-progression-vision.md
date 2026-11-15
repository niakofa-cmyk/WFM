# WAR FOR MARS: Integrating Multiplayer and Rewards Into the Full Game Vision

My recommendation is to **preserve the multiplayer and reward rules that already exist, but evolve them into a unified system that supports flight combat, exploration, missions, factions, cooperative play, competitive matches, and long-term progression.**

We should not build a separate reward system for every game mode. We should establish one authoritative rules framework that determines how matches work, how objectives are completed, how rewards are earned, how players progress, and how the persistent universe responds.

The core design principle is:

> **Every activity should matter to the player’s journey through the universe, but no single activity should be mandatory for every type of player.**

A competitive pilot should be able to advance through combat. An explorer should advance through discovery. A cooperative player should contribute through missions and team objectives. Players who enjoy the campaign should see their actions change their standing with the factions and unlock new opportunities.

These activities can share progression without making competitive matches unfair or allowing players to exploit the reward economy.

One important distinction: the existing WFM codebase has a multiplayer simulation and room-based gameplay architecture, while the broader vision calls for a persistent, explorable 3D universe. We should extend the current systems rather than assume that the complete persistent universe or all the rules described below are already implemented.

---

## 1. Establish one rules framework for the entire game

I would organize WFM around five connected systems.

| System | Responsibility | Examples |
|---|---|---|
| **Flight and combat rules** | Determine what happens during gameplay | Movement, weapons, damage, destruction, respawns |
| **Match and mission rules** | Determine how an activity begins, progresses, and ends | Team Deathmatch, escort missions, exploration objectives |
| **Multiplayer rules** | Determine who can participate and how sessions remain fair | Matchmaking, squads, team assignment, disconnects, anti-cheat |
| **Reward and progression rules** | Determine what players earn and what they unlock | XP, credits, faction standing, equipment unlocks |
| **Persistent universe rules** | Determine how completed activities affect the wider game | Sector access, campaign progress, faction control, exploration records |

These systems should communicate through well-defined server-side events.

For example:

1. A player enters a combat sector.
2. The server creates or joins the appropriate multiplayer session.
3. The player completes an objective or participates in combat.
4. The authoritative game simulation records the result.
5. The match or mission rules determine whether the player contributed to the outcome.
6. The reward service validates the result and calculates the award.
7. The progression service records the award and unlocks any newly available content.
8. The campaign service updates the player's persistent universe state when appropriate.

This architecture prevents an important problem: **the client should never be able to award itself currency, declare its own victory, or directly modify persistent progression.**

The client can display rewards, but the server must authorize them.

## 2. What WFM already has—and what needs to change

I reviewed the repository's multiplayer policy, reward-safety documentation, progression schema, persistent-world schema, and test report on the available `main` branch. The distinction matters because some foundations are already implemented, while others are still proposed.

The relevant code and documentation are available in the [WFM repository](https://github.com/niakofa-cmyk/WFM).

### Existing multiplayer rules

The current alpha has:

- **Invite-code rooms** with ten seats, split into two teams of five.
- AI filling vacant seats.
- A ready-up and host-controlled launch flow.
- Independent rooms rather than one shared live galaxy.
- A five-second window for a disconnected player to reclaim their seat.
- Rejection of late joins once a match is active.
- A six-minute Strike match.
- Explicit interruption when the socket server restarts; unfinished matches are not restored.
- No rewards for interrupted online matches.

These are intentional alpha policies, not necessarily permanent limitations. See the [multiplayer alpha policy](https://github.com/niakofa-cmyk/WFM/blob/main/docs/multiplayer-alpha-verification.md).

### Existing reward and universe rules

The backend already has substantial single-player progression infrastructure:

- Server-owned player credits and selected ships.
- Mission clears, technology unlocks, and ship refits.
- Persistent campaign locations and travel.
- Discoveries and side quests.
- Reputation with the Accord and USSF factions.
- A shared market with account-owned inventory and transaction records.
- Daily world events that influence market prices.
- Idempotent reward claims, transaction records, and checks against forged client balances or duplicate claims.

The current database schema includes `player_progress`, `strike_runs`, `progression_events`, `player_world_state`, `world_discoveries`, `player_quests`, and market tables.

The important gap is that **online multiplayer results are not yet connected to persistent player rewards**. The current policy deliberately prevents online matches from granting credits or campaign progression. That separation protects the economy, but it means the multiplayer experience does not yet contribute to the larger player journey.

The [progression schema](https://github.com/niakofa-cmyk/WFM/blob/main/lib/db/src/schema/progression.ts), [universe schema](https://github.com/niakofa-cmyk/WFM/blob/main/lib/db/src/schema/universe.ts), and [test report](https://github.com/niakofa-cmyk/WFM/blob/main/artifacts/war-for-mars/TEST-REPORT.md) document these foundations.

### The key decision

I would **keep the existing multiplayer room rules and existing single-player reward logic, then introduce a secure server-side bridge between them**.

We should not replace working progression code, create a second credit balance, or let multiplayer clients write directly to the campaign database.

We should also preserve the current alpha's isolated-room design. Persistent player progression does not require a shared real-time galaxy, and we do not need to introduce matchmaking or a continuously simulated shared universe to make the game rewarding.

---

## 3. Create one reward system with multiple earning paths

I recommend that WFM use a common reward ledger, with rewards determined by the activity that generated them.

### Proposed reward categories

| Reward | What it represents | Where it can be earned |
|---|---|---|
| **Credits** | Spendable in-game currency | Validated matches, missions, contracts, and other approved activities |
| **Faction reputation** | A player's standing with the USSF or Accord | Faction-aligned missions, objectives, and campaign choices |
| **Discoveries** | Persistent records of places, signals, objects, or intelligence discovered | Exploration and designated discovery missions |
| **Campaign progression** | Access to subsequent missions, locations, and story content | Required campaign objectives and validated story outcomes |
| **Equipment and technology unlocks** | New ships, refits, abilities, and equipment options | Defined progression milestones and eligible activities |
| **Account XP and level** | A measure of overall experience, if we add this system | Eligible combat, exploration, cooperative, and campaign activities |
| **Competitive rating** | A measure of competitive performance | Eligible ranked matches, once a ranked mode is introduced |

**Account XP and competitive rating are recommendations, not claims about existing implemented systems.** Credits, faction reputation, campaign progression, discoveries, and equipment-related progression already have foundations in WFM.

I would keep competitive rating separate from account XP. A player should be able to explore, play the campaign, and unlock content without having to maintain a competitive rank.

Likewise, a player's competitive rank should not be determined simply by how many hours they have played or how many credits they have accumulated.

### One ledger, different reward policies

Every reward should be attached to a validated event, such as:

- `online_match_completed`
- `mission_completed`
- `objective_completed`
- `discovery_recorded`
- `contract_claimed`
- `campaign_milestone_completed`

Each event would identify the authenticated player, source activity, relevant mode, reward policy version, and resulting changes.

For example, an online victory might produce credits and account XP, while a first-time campaign discovery might grant credits, faction reputation, and a persistent discovery record.

The reward policy determines which rewards are permitted for each event. It should not simply grant every reward category to every activity.

That allows us to expand the game without rebuilding the reward economy every time we add a new mission type.

---

## 4. Connect multiplayer to persistent progression

This is the most important implementation change.

The existing online game and the persistent campaign should remain separate during active gameplay, but successful completion of an online activity should produce a trusted result that the progression service can process.

### The proposed architecture

```text
                  WAR FOR MARS
                        |
             Authenticated player
                        |
                Select activity
                        |
          +-------------+-------------+
          |             |             |
       Campaign      Exploration   Multiplayer
          |             |             |
     Mission sim    Sector sim     Match room
          |             |             |
          +-------------+-------------+
                        |
                Authoritative server
                        |
              Validate activity result
                        |
                 Reward policy engine
                        |
                Persistent reward ledger
                        |
          +-------------+-------------+
          |             |             |
        Credits      Reputation    Account XP
          |             |             |
          +-------------+-------------+
                        |
              Persistent player state
                        |
           +------------+-------------+
           |            |             |
        Hangar       Galaxy        Missions
           |            |             |
        Refits       Travel       New content
```

The diagram represents the proposed integration, not an existing end-to-end implementation.

### Step A: Keep the match server authoritative

The multiplayer server should remain responsible for determining:

- Which players actually joined the match.
- Which team each player belonged to.
- Whether the match launched and completed.
- Which objectives were completed.
- Which ships were destroyed and by whom.
- Whether the result was a victory, defeat, draw, or interruption.
- Whether individual actions qualify for rewards.

The client can send control inputs and display the match, but it must not decide the final outcome or reward amount.

WFM already has an authoritative WebSocket simulation and testing for ten-client rooms. However, the current test report also identifies remaining limitations in control parity, combat consistency certification, and protection against valid-looking but manipulated client inputs.

We must close those gaps before treating competitive results as fully trustworthy.

### Step B: Produce a server-validated match result

When a match ends normally, the server should create a final result containing information along these lines:

```ts
type ValidatedMatchResult = {
  matchId: string;
  mode: "strike" | "cooperative" | "exploration";
  rulesVersion: number;

  status: "completed";
  outcome: "victory" | "defeat" | "draw";

  players: Array<{
    userId: string;
    teamId: string;
    participation: "completed" | "disconnected";
    contribution: {
      objectivesCompleted: number;
      confirmedEliminations: number;
      assists: number;
      supportActions: number;
    };
  }>;

  completedObjectives: string[];
  completedAt: string;
};
```

This is an illustrative design for the proposed integration, not an existing WFM type.

The server must derive these values from its own simulation and event history, rather than accept them as facts supplied by the client.

For example, a client should not be allowed to claim 20 eliminations merely by sending that number in a request.

### Step C: Calculate each player's reward

The reward engine receives the validated result and the applicable reward policy.

It calculates each player's eligible rewards separately.

A simplified formula could be:

**Individual reward = completion reward + eligible contribution reward + eligible objective rewards + applicable bonus**

Each component should be bounded by the activity's rules.

For example:

| Match result | Proposed treatment |
|---|---|
| Victory | Eligible victory reward plus validated personal contributions |
| Defeat | Eligible participation and contribution rewards |
| Draw | Draw-specific completion reward |
| Objective completed | Additional reward if the mode permits it |
| Match abandoned by the player | Apply the mode's disconnect and completion policy |
| Server restart or interrupted match | No match rewards under the current alpha policy |
| Duplicate reward claim | Return the existing result without awarding again |
| Invalid or unverifiable result | Reject the reward claim |

These are proposed policies to implement. The current alpha already specifies that interrupted matches receive no rewards; the other online payout rules still need to be defined and implemented.

**A defeat should not automatically mean zero rewards.** Otherwise, players on the losing team may feel that their time was wasted, and players may be encouraged to abandon matches that are going badly.

At the same time, rewards must not be so generous that players can farm them by repeatedly losing or cooperating with opponents to manipulate results.

### Step D: Apply rewards atomically

Once the result is validated, the backend should:

1. Verify the match is eligible for rewards.
2. Verify the authenticated account owns the relevant player record.
3. Verify the match has not already been paid.
4. Calculate rewards using the applicable policy version.
5. Record the reward event and update the player's balance in a single database transaction.
6. Return the persisted result to the client.

If the client retries because of a network timeout, the server should return the previously committed result rather than issue a second payment.

This extends an existing WFM strength: the single-player progression system already uses idempotency and transactional reward recording.

I would extend the current `progression_events` model or introduce a related match-reward record with a unique match/player reward key. The implementation should use the existing database conventions rather than create a competing ledger.

---

## 5. Make rewards support the entire universe

We should make multiplayer meaningful to the larger game without forcing every activity to become a competitive match.

I recommend five connected activity loops.

### Loop 1: Competitive flight combat

This is the closest to the existing five-versus-five Strike mode.

Players enter an invite-code room, prepare their ships, choose teams, and fight through a defined objective.

Potential future modes include:

- Team Deathmatch.
- Air Superiority or space superiority.
- Elimination.
- Escort and interception.
- Control-point capture.
- Convoy defense.
- Sector defense.

These are proposed modes, not a statement that they are all implemented.

The existing ten-seat room architecture is a sensible foundation for the first competitive modes.

**Reward philosophy:** reward winning, participation, and legitimate contribution without making the losing team worthless or rewarding repetitive exploitation.

Combat rewards can contribute to credits and account XP. Faction reputation should depend on the mode and the mission's faction context rather than being automatically granted for every elimination.

### Loop 2: Cooperative missions

Cooperative missions give players a reason to work together beyond defeating one another.

Examples include:

- Defending a damaged station.
- Escorting a transport through hostile space.
- Destroying a weapons platform.
- Recovering stranded pilots.
- Protecting a scientific expedition.
- Investigating an unknown signal.
- Recovering technology from a dangerous wreck.

A mission might require different roles: one pilot protects the convoy, another intercepts enemy fighters, and another disables the weapons platform.

The server tracks mission objectives and individual participation. Rewards are based on the completed mission and valid contributions.

This creates an opportunity for different ship classes to matter. A support-oriented ship can contribute through protection or assistance instead of needing the highest elimination count.

**Reward philosophy:** team success matters, and individual contributions should be recognized without encouraging teammates to compete against one another for every objective.

For the first version, I would run cooperative missions inside isolated sessions rather than create a persistent, shared galaxy.

### Loop 3: Exploration and discovery

This is where the current persistent-world system can evolve toward the larger universe vision.

WFM already has persistent campaign locations, travel, discoveries, quests, and faction reputation. Those are valuable foundations for exploration.

We could expand the loop so a player:

1. Travels to an unlocked location.
2. Launches into its 3D flight sector.
3. Investigates an anomaly, wreck, signal, or uncharted object.
4. Completes a server-validated discovery objective.
5. Returns to a station or completes the relevant activity.
6. Receives the appropriate reward and persistent discovery record.
7. Unlocks additional routes, contracts, intelligence, or campaign opportunities where specified by the progression rules.

For example, a future mission in the proposed *Pale Beacons* region could ask players to investigate an abandoned navigation network. Completing the investigation could record the discovery and unlock a follow-up mission.

The location name and mission are creative proposals, not existing game content.

**Reward philosophy:** exploration should be valuable even when no enemy is destroyed.

Discoveries could grant account XP, credits, and mission-specific rewards. Faction reputation would depend on what the player discovers and what they do with that information.

A first-discovery reward should be granted only once per eligible account or other explicitly defined ownership scope. Repeat exploration might still earn a smaller mission reward, but should not repeatedly pay the first-discovery bonus.

### Loop 4: Campaign and faction progression

The existing single-player campaign includes the four-sortie foundation—Contact, Beacon, Warden, and Cage—along with server-enforced progression and technology unlocks.

We should connect multiplayer and exploration to this campaign carefully.

A player might earn the reputation required to access a faction contract through a mix of campaign missions, exploration, and eligible multiplayer activities. But a competitive match should not automatically clear a story mission simply because the player won.

I recommend keeping three progression dimensions distinct:

- **Personal progression:** the player's earned credits, discoveries, equipment, and other account records.
- **Faction standing:** the player's reputation with the USSF and Accord.
- **Campaign state:** the specific missions and story milestones the player has completed.

These can influence one another through explicit rules, but they should not be interchangeable.

For instance, earning Accord reputation might unlock an Accord contract. It should not automatically mark an unrelated campaign mission as complete.

That separation also protects story integrity as new multiplayer modes are added.

### Loop 5: The player economy

WFM already has a shared market model, account-owned inventory, credits, transaction records, and persistent world-event price modifiers.

That gives us an existing economic foundation to build on.

The economy could connect activities to meaningful purchases:

- Credits earned through eligible activities.
- Resources acquired through approved missions and trading.
- Ship refits and equipment options.
- Technology unlocked through progression requirements.
- Travel fares between unlocked locations.
- Market opportunities affected by world events.

We should not make the economy a simple treadmill in which players must repeatedly grind the same match to afford essential equipment.

Instead, different play styles should offer viable ways to earn rewards, while the cost and availability of equipment create meaningful choices.

**Competitive fairness is critical:** stronger equipment must not simply be purchasable in a way that makes a wealthier or more experienced player unbeatable in a competitive match.

We should distinguish between progression that expands a player's options and progression that gives them an unfair statistical advantage.

For competitive modes, we can use standardized ship configurations, normalized combat stats, mode-specific equipment restrictions, or carefully balanced progression rules.

The right approach should be tested against WFM's actual ship balance rather than assumed in advance.

---

## 6. Establish the reward rules before tuning the amounts

I would not begin by assigning arbitrary credit payouts to every mode. First, define the reward rules and then tune the numbers using playtests and economy simulations.

### Recommended rules

| Rule | Why it matters |
|---|---|
| Rewards are calculated server-side | Prevents forged payouts |
| One match can be paid only once | Prevents duplicate claims |
| Interrupted matches pay nothing under the current alpha policy | Preserves the established restart behavior |
| Eligible defeats can still grant bounded rewards | Discourages abandonment and frustration |
| Objectives can reward multiple roles | Encourages teamwork |
| First-time discoveries are recorded persistently | Makes exploration meaningful |
| Campaign milestones require their own conditions | Protects story progression |
| Reward amounts are bounded by activity and policy | Prevents runaway payouts |
| Competitive rating is separate from spendable currency | Prevents economic wealth from defining rank |
| All credit changes have an auditable ledger entry | Makes balance disputes and economy audits possible |
| Disconnects follow explicit mode-specific rules | Avoids inconsistent treatment |
| Rewards use a versioned policy | Makes balance changes auditable and reproducible |

### Prevent reward farming

We should specifically test for:

- Players repeatedly trading kills with a friend.
- Players leaving and rejoining to trigger completion rewards.
- A team intentionally losing to farm participation rewards.
- Replaying the same discovery or mission claim.
- A modified client submitting false contributions.
- Replaying an old valid result against a new account state.
- Repeated reward requests after a timeout.
- Multiple accounts exploiting shared-market transactions.

WFM already has several relevant safeguards, including strict request validation, server-owned progression, idempotent claims, and database constraints.

Those safeguards are a foundation, not proof that every multiplayer exploit has been eliminated. The current test report explicitly identifies replay-abuse limitations and the absence of full production and human-playtest certification.

---

## 7. Extend the architecture without destabilizing existing systems

I would implement the integration in layers.

### Layer A: Match result service

Create a dedicated server-side service responsible for accepting a completed match from the authoritative simulation and producing a validated, immutable result.

It should handle:

- Match identity.
- Player participation.
- Team outcome.
- Objective results.
- Individual contribution records.
- Completion and interruption reasons.
- Rules version and result integrity.

The result should be durable enough to support retries and audits, even if the socket server subsequently restarts.

This does **not** mean we need to persist and restore active matches. Under the current alpha policy, active matches remain ephemeral. We can persist a result after successful completion while still discarding an unfinished match after a restart.

### Layer B: Reward policy service

Implement a pure, testable reward calculator that accepts a validated result and a policy configuration.

Conceptually:

```ts
calculateRewards({
  result: validatedMatchResult,
  playerId,
  policy: rewardPolicy,
});
```

It should return a proposed reward breakdown, not directly write to the database.

A separate transaction service would validate eligibility and commit the reward.

Keeping calculation separate from persistence makes it easier to test balance changes, simulate reward distributions, and compare different policy versions without modifying player balances.

### Layer C: Persistent reward ledger

Extend the existing progression architecture so online rewards can be committed idempotently.

I would record at least:

- Unique reward event ID.
- Match ID and player ID.
- Activity and mode.
- Reward-policy version.
- Reward breakdown.
- Previous and resulting balances.
- Creation timestamp.
- Claim or settlement status, if the chosen processing flow needs one.

The schema must enforce the appropriate uniqueness constraints. Application-level checks alone are insufficient for preventing duplicate awards during concurrent requests.

### Layer D: Progression integration

After a reward is committed, apply only the progression effects permitted by the relevant rules.

For example:

- Credit rewards update the existing credit balance.
- Faction rewards update the appropriate faction reputation.
- Discovery rewards create the required persistent discovery record.
- Campaign rewards update only the relevant campaign state.
- Account XP updates the proposed XP system, if and when it is implemented.

These operations should be transactional when they constitute one logical reward, so a failure cannot leave the player with credits but no required reward record—or vice versa.

### Layer E: Client results and feedback

After settlement, the client should display a clear end-of-activity screen showing:

- Match outcome.
- Team performance.
- Individual contributions.
- Credits earned.
- XP earned, if implemented.
- Faction reputation changes, where applicable.
- Objectives completed.
- New discoveries or unlocks.
- Any reward that was withheld and the reason.

The client should receive the persisted server result, not calculate a second version locally.

This is also where the larger game vision becomes tangible. Players should understand not just that they received currency, but **what their actions accomplished and how those actions move them forward in WAR FOR MARS**.

---

## 8. Introduce a persistent universe in stages

The current design intentionally separates isolated multiplayer rooms from the persistent single-player universe. I would preserve that boundary initially.

The long-term architecture can still support a richer universe without requiring every location to be continuously simulated for every player.

### Stage 1: Persistent individual progression

Players share the same economy rules and world-event definitions, but each player's campaign location, discoveries, reputation, and mission progress remain account-specific.

This is closest to the current foundation.

### Stage 2: Multiplayer missions inside sector instances

Players can join a mission together in a particular sector. The mission has its own authoritative simulation, objectives, and completion result.

When it ends, validated rewards are committed to each participant's persistent account.

The sector instance does not need to remain alive after the mission ends.

### Stage 3: Shared consequences

Once the reward and progression systems are stable, introduce persistent world consequences that can be safely shared across players.

For example, a future faction campaign might accumulate eligible mission results toward a sector-control objective.

This requires explicit rules for contribution, reset periods, faction eligibility, and conflict resolution. It should not be implemented merely by letting individual clients modify a shared control value.

### Stage 4: A larger connected universe

Only after the earlier stages are stable should we consider more ambitious features such as coordinated sector operations, broader faction campaigns, or a shared real-time galaxy.

Those features would require their own capacity, persistence, matchmaking, and consistency decisions.

**The key point:** the game can feel like one expanding universe before every player inhabits the same continuously running simulation.

That lets us grow toward the vision without prematurely introducing the cost and complexity of a massive shared-world architecture.

---

## 9. The implementation roadmap I recommend

I would deliver this as a sequence of small, testable changes in the WFM repository rather than one large multiplayer rewrite.

| Phase | Work | Acceptance criteria |
|---|---|---|
| **1. Audit current contracts** | Map existing room lifecycle, match results, reward APIs, progression transactions, and database constraints | Written implementation map; no existing progression contract is silently replaced |
| **2. Define reward policies** | Specify eligible activities, outcomes, contribution rules, and reward limits | Unit-tested policies for victory, defeat, draw, interruption, and invalid results |
| **3. Persist validated match results** | Add the result model and server-side completion path | Results originate from authoritative server state and are uniquely identified |
| **4. Integrate online reward settlement** | Connect eligible results to the existing progression ledger | Valid matches pay once; duplicate and concurrent claims cannot double-pay |
| **5. Add player result summaries** | Show outcome, contribution, and persisted rewards | UI matches the server's committed result |
| **6. Add cooperative mission rewards** | Reuse the same reward service for objective-based missions | Multiple roles can earn legitimate rewards from one completed mission |
| **7. Integrate faction and discovery rewards** | Connect eligible multiplayer mission results to existing persistent-world records | Reputation and discovery rules remain separate from unrelated campaign clears |
| **8. Add economy and exploit tests** | Test farming, duplicate claims, concurrent requests, disconnects, and malformed results | Automated regression suite passes |
| **9. Conduct human multiplayer tests** | Test actual player behavior, team balance, and reward fairness | Evidence includes real sessions and independently verified outcomes |
| **10. Expand the sector universe** | Add further missions, regions, and shared consequences | New activities use the same validated result and reward contracts |

### Important: do not skip the first phase

Before modifying code, I would map the actual current implementation and its contracts.

The repository has progressed across multiple commits, and the available test report describes particular verified commits. We should confirm the current `main` implementation before changing files or claiming that a specific function or endpoint already exists.

I would also preserve the current account-authentication boundary and database architecture. Reward integration should use the authenticated identity supplied by the existing auth middleware, not a player ID or credit amount that the client is allowed to choose.

Production deployment and production-account behavior must be certified separately from local tests.

---

## 10. How we should test the integrated system

The most important tests are not simply whether a match ends or whether a credit balance changes. We need to verify that the whole lifecycle is correct.

### Match lifecycle tests

- Two teams can join, ready up, and launch.
- A match completes normally and produces one authoritative result.
- A draw is handled correctly.
- A server restart interrupts the match and awards nothing.
- A temporary disconnect follows the existing five-second reconnection rule.
- A late join cannot enter an active match.
- A stale session cannot submit a result for a different match.

### Reward tests

- A valid completed match awards the correct amount.
- The same result claimed twice does not award twice.
- Concurrent duplicate claims produce one settlement.
- A defeat follows the configured defeat policy.
- A draw follows the configured draw policy.
- An invalid or incomplete result is rejected.
- A player cannot claim another player's reward.
- A changed or forged result cannot replace an already-committed result.
- A database failure cannot leave an inconsistent balance and ledger.

### Persistence tests

- Credits survive a new session.
- A player's faction reputation survives reconnects and restarts.
- Discoveries and completed quests persist.
- Campaign progress does not change unless the required campaign conditions are met.
- Two accounts cannot modify each other's progression.
- Replaying an earlier request cannot duplicate a reward.
- A new reward policy does not silently recalculate or overwrite past awards.

### Fairness tests

- Objective-oriented players can contribute meaningfully.
- A losing team can still earn eligible rewards.
- A player cannot farm unlimited rewards through repeated matches or self-serving behavior.
- A stronger ship or higher account level does not automatically make competitive combat unfair.
- The reward economy remains sustainable as players accumulate credits.

WFM's existing automated multiplayer tests provide a useful starting point: ten-client local sessions, room isolation, reconnect tests, and controlled network impairment have already been exercised. But real human sessions, WAN reliability, comprehensive combat consistency, and production-account flows remain separate certification requirements.

---

## My final recommendation

**Build the reward bridge before expanding multiplayer into a much larger world.**

The existing WFM architecture already gives us three valuable foundations:

1. An authoritative multiplayer room and simulation system.
2. A server-owned progression and economy system.
3. A persistent campaign and exploration foundation.

The next step is to connect them through a validated, idempotent match-result and reward-settlement service.

That gives us a coherent progression loop:

**Fly → Fight or Explore → Complete Objectives → Earn Validated Rewards → Upgrade or Unlock → Travel Further → Discover More → Take on Greater Challenges.**

Competitive players, explorers, and cooperative pilots can all advance through that loop, while the game preserves fair combat, meaningful choices, and the integrity of the persistent economy.

My first implementation milestone would therefore be:

**`feat(wfm): connect authoritative multiplayer results to persistent rewards`**

It should add the smallest safe end-to-end path from a completed online Strike to a persisted reward, preserve the existing no-reward interruption policy, and prove through automated tests that the same match can never pay twice.

Once that milestone is secure, we can reuse the same foundation for cooperative missions, faction operations, and the larger explorable universe—without building a separate progression system for every new feature.