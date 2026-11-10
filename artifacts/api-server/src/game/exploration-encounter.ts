import { createHash } from "node:crypto";
import { ORBITAL_RUNTIME_ID } from "@workspace/orbital-sim";

export const EXPLORATION_CONTRACT = "orbital-exploration-v1" as const;
export type Faction = "ussf" | "accord";
export type FactionTerritory = Faction | "neutral" | "contested";
export type PilotTransponder = "broadcast" | "silent";
export type ContactStage =
  | "unaware" | "investigating" | "shadowing" | "challenging"
  | "warning" | "intercepting" | "reinforcements";
export type ContactAction = "none" | "scan" | "shadow" | "challenge" | "warn" | "intercept" | "request_reinforcements";
export type FactionContactDecision = {
  actorFaction: Faction;
  stage: ContactStage;
  action: ContactAction;
  reason: "no_sensor_contact" | "passive_contact" | "transponder_silent" |
    "restricted_territory" | "high_speed" | "targeting" | "weapons_hot" |
    "warning_ignored" | "hostile_damage" | "close_approach";
  territory: FactionTerritory;
  transponder: PilotTransponder;
  distanceMeters: number;
  sensorRangeMeters: number;
  speedMetersPerSecond: number;
  lineOfSight: boolean;
  weaponsHot: boolean;
  targeting: boolean;
  enteredAtTick: number;
};
export type FactionContactObservation = {
  actorFaction: Faction;
  pilotFaction: Faction;
  territory: FactionTerritory;
  transponder: PilotTransponder;
  distanceMeters: number;
  sensorRangeMeters: number;
  speedMetersPerSecond: number;
  speedLimitMetersPerSecond: number;
  lineOfSight: boolean;
  weaponsHot: boolean;
  targeting: boolean;
  recentHostileAction: boolean;
  warningTicks: number;
  tick: number;
};

/** Deterministic faction response policy; caller supplies server-derived state only. */
export function decideFactionContact(input: FactionContactObservation): FactionContactDecision {
  if (!["ussf", "accord"].includes(input.actorFaction) ||
      !["ussf", "accord"].includes(input.pilotFaction) ||
      input.actorFaction === input.pilotFaction ||
      !["ussf", "accord", "neutral", "contested"].includes(input.territory) ||
      !["broadcast", "silent"].includes(input.transponder) ||
      ![input.distanceMeters, input.sensorRangeMeters, input.speedMetersPerSecond,
        input.speedLimitMetersPerSecond, input.warningTicks, input.tick].every(Number.isFinite) ||
      input.distanceMeters < 0 || input.sensorRangeMeters <= 0 ||
      input.speedMetersPerSecond < 0 || input.speedLimitMetersPerSecond <= 0 ||
      input.warningTicks < 0 || input.tick < 0 ||
      typeof input.lineOfSight !== "boolean" || typeof input.weaponsHot !== "boolean" ||
      typeof input.targeting !== "boolean" || typeof input.recentHostileAction !== "boolean") {
    throw new Error("Invalid faction contact observation.");
  }
  const detected = input.lineOfSight && input.distanceMeters <= input.sensorRangeMeters;
  let stage: ContactStage = "unaware";
  let action: ContactAction = "none";
  let reason: FactionContactDecision["reason"] = "no_sensor_contact";
  if (detected) {
    const incursion = input.territory === input.actorFaction;
    const highSpeed = input.speedMetersPerSecond >= input.speedLimitMetersPerSecond * 0.72;
    if (input.recentHostileAction) {
      stage = "reinforcements"; action = "request_reinforcements"; reason = "hostile_damage";
    } else if (input.actorFaction === "ussf") {
      if (input.transponder === "silent" && input.distanceMeters <= input.sensorRangeMeters * 0.85) {
        stage = input.warningTicks >= 180 ? "intercepting" : "challenging";
        action = input.warningTicks >= 180 ? "intercept" : "challenge";
        reason = input.warningTicks >= 180 ? "warning_ignored" : "transponder_silent";
      } else if (input.weaponsHot || input.targeting || highSpeed || incursion) {
        const ignored = input.warningTicks >= 180;
        stage = ignored ? "intercepting" : "warning";
        action = ignored ? "intercept" : "warn";
        reason = incursion ? "restricted_territory"
          : input.weaponsHot ? "weapons_hot" : input.targeting ? "targeting" : "high_speed";
      } else if (input.distanceMeters <= 450) {
        stage = "challenging"; action = "challenge"; reason = "close_approach";
      } else {
        stage = "investigating"; action = "scan"; reason = "passive_contact";
      }
    } else if (input.weaponsHot || input.targeting || highSpeed || incursion) {
      stage = "intercepting"; action = "intercept";
      reason = incursion ? "restricted_territory"
        : input.weaponsHot ? "weapons_hot" : input.targeting ? "targeting" : "high_speed";
    } else if (input.transponder === "silent") {
      stage = input.distanceMeters <= input.sensorRangeMeters * 0.65 ? "intercepting" : "shadowing";
      action = stage === "intercepting" ? "intercept" : "shadow";
      reason = "transponder_silent";
    } else if (input.distanceMeters <= 450) {
      stage = "intercepting"; action = "intercept"; reason = "close_approach";
    } else {
      stage = "investigating"; action = "scan"; reason = "passive_contact";
    }
  }
  return {
    actorFaction: input.actorFaction, stage, action, reason, territory: input.territory,
    transponder: input.transponder, distanceMeters: Math.round(input.distanceMeters),
    sensorRangeMeters: Math.round(input.sensorRangeMeters),
    speedMetersPerSecond: Math.round(input.speedMetersPerSecond),
    lineOfSight: input.lineOfSight, weaponsHot: input.weaponsHot,
    targeting: input.targeting, enteredAtTick: input.tick,
  };
}
export type ExplorationActor = {
  id: string;
  faction: Faction;
  hull: number;
  /** Derived from the authenticated server roster, never an input packet. */
  playerId?: string;
  /** Only explicitly approved NPC targets can generate kill credits. */
  rewardEligible?: boolean;
};
export type ExplorationPolicy = {
  id: string;
  creditsPerNpcKill: number;
  completionCredits: number;
  maxCreditsPerEncounter: number;
};
export type ExplorationEncounterSpec = {
  encounterId: string;
  missionId?: "pale-beacons" | "universe-patrol";
  sectorId: string;
  runtime: typeof ORBITAL_RUNTIME_ID;
  authority: "server";
  mode: "universe-exploration";
  patrol?: {
    patrolId: string;
    locationId: string;
    faction: "ussf" | "accord";
  };
  actors: readonly ExplorationActor[];
  rewardPolicy: ExplorationPolicy;
};
export type ServerDamageEvent = {
  eventId: string;
  tick: number;
  attackerActorId: string;
  targetActorId: string;
  hullDamage: number;
};
export type ExplorationPilotResult = {
  playerId: string;
  kills: number;
  assists: number;
  destroyedActorIds: readonly string[];
  rewardableNpcKills: number;
  credits: number;
};
export type ExplorationResult = {
  version: typeof EXPLORATION_CONTRACT;
  encounterId: string;
  missionId: "pale-beacons" | "universe-patrol";
  sectorId: string;
  runtime: typeof ORBITAL_RUNTIME_ID;
  policyId: string;
  rewardPolicy: Readonly<ExplorationPolicy>;
  patrol?: Readonly<{
    patrolId: string;
    locationId: string;
    faction: "ussf" | "accord";
  }>;
  fingerprint: string;
  outcome: "completed" | "aborted";
  finalTick: number;
  objectiveCompleted: boolean;
  pilots: readonly Readonly<ExplorationPilotResult>[];
  /** Every destroyed member of the reserved enemy patrol, including NPC final blows. */
  patrolDestroyedActorIds?: readonly string[];
};
declare const receiptBrand: unique symbol;
export type ExplorationReceipt = Readonly<{
  encounterId: string;
  [receiptBrand]: true;
}>;

export type ExplorationEncounterSnapshotV1 = {
  version: 1;
  spec: ExplorationEncounterSpec;
  damage: Array<[string, string[]]>;
  kills: Array<[string, string[]]>;
  assists: Array<[string, number]>;
  events: Array<[string, string]>;
  chain: string;
  tick: number;
  finalization?: {
    finalTick: number;
    outcome: "completed" | "aborted";
    objectiveCompleted: boolean;
  };
  resultFingerprint?: string;
};

// A serialized browser result, spread copy, or object with a matching shape
// cannot become an authority receipt. No route accepts these objects.
const receipts = new WeakMap<object, Readonly<ExplorationResult>>();
// PostgreSQL jsonb may reorder object properties when recovering a pinned spec.
// Hash values, not insertion order, so a legitimate replay stays idempotent.
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value, (_key, entry) =>
  entry && typeof entry === "object" && !Array.isArray(entry)
    ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
    : entry,
)).digest("hex");
function id(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_:-]{1,128}$/.test(value)) {
    throw new Error("Invalid exploration identity.");
  }
}
function integer(value: number, max = 2_147_483_647): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new Error("Invalid exploration integer.");
  }
}

export function readExplorationReceipt(receipt: ExplorationReceipt): Readonly<ExplorationResult> {
  const result = receipt && typeof receipt === "object" ? receipts.get(receipt) : undefined;
  if (!result) throw new Error("Server-issued exploration receipt required.");
  return result;
}

/**
 * Server-only adapter contract, not a physics engine. The authoritative Orbital
 * runtime calls recordDamage AFTER validating weapons, collision and inputs.
 * Never call it from a client-supplied kill/result/amount endpoint.
 */
export class ExplorationEncounter {
  private readonly spec: ExplorationEncounterSpec;
  private readonly actors = new Map<string, ExplorationActor>();
  private readonly damage = new Map<string, Set<string>>();
  private readonly kills = new Map<string, string[]>();
  private readonly assists = new Map<string, number>();
  private readonly events = new Map<string, string>();
  private chain: string;
  private tick = 0;
  private receipt?: ExplorationReceipt;
  private finalization?: ExplorationEncounterSnapshotV1["finalization"];

  constructor(spec: ExplorationEncounterSpec) {
    id(spec.encounterId); id(spec.sectorId); id(spec.rewardPolicy.id);
    if (spec.missionId !== undefined && !["pale-beacons", "universe-patrol"].includes(spec.missionId)) {
      throw new Error("Unsupported exploration mission.");
    }
    if (spec.authority !== "server" || spec.mode !== "universe-exploration" || spec.runtime !== ORBITAL_RUNTIME_ID) {
      throw new Error("Unsupported exploration authority, mode or runtime.");
    }
    if (spec.patrol) {
      id(spec.patrol.patrolId);
      id(spec.patrol.locationId);
      if (!["ussf", "accord"].includes(spec.patrol.faction) ||
          spec.actors.some((actor) => actor.rewardEligible === true && actor.faction !== spec.patrol!.faction) ||
          spec.actors.some((actor) => actor.playerId && actor.faction === spec.patrol!.faction)) {
        throw new Error("Invalid opposing patrol encounter.");
      }
    } else if (spec.missionId === "universe-patrol") {
      throw new Error("Universe patrol mission requires a persistent patrol.");
    }
    for (const value of [spec.rewardPolicy.creditsPerNpcKill, spec.rewardPolicy.completionCredits, spec.rewardPolicy.maxCreditsPerEncounter]) integer(value);
    if (spec.actors.length < 2 || spec.actors.length > 128) throw new Error("Invalid exploration roster size.");
    const players = new Set<string>();
    for (const actor of spec.actors) {
      id(actor.id);
      if (this.actors.has(actor.id) || !["ussf", "accord"].includes(actor.faction) || !Number.isFinite(actor.hull) || actor.hull <= 0 || actor.hull > 1_000_000) {
        throw new Error("Invalid exploration actor.");
      }
      if (actor.playerId !== undefined) {
        id(actor.playerId);
        if (players.has(actor.playerId) || actor.rewardEligible) throw new Error("Duplicate pilot or rewardable player target.");
        players.add(actor.playerId);
        this.kills.set(actor.playerId, []);
        this.assists.set(actor.playerId, 0);
      }
      this.actors.set(actor.id, { ...actor });
    }
    if (players.size < 1 || players.size > 32) throw new Error("Invalid exploration pilot roster.");
    this.spec = structuredClone(spec);
    this.spec.actors = [...this.spec.actors].sort((a, b) => a.id.localeCompare(b.id));
    this.chain = hash(this.spec);
  }

  static restore(snapshot: ExplorationEncounterSnapshotV1): ExplorationEncounter {
    if (!snapshot || snapshot.version !== 1 ||
        !Array.isArray(snapshot.damage) || !Array.isArray(snapshot.kills) ||
        !Array.isArray(snapshot.assists) || !Array.isArray(snapshot.events) ||
        !/^[a-f0-9]{64}$/.test(snapshot.chain) ||
        !Number.isSafeInteger(snapshot.tick) || snapshot.tick < 0) {
      throw new Error("Invalid exploration checkpoint.");
    }
    const contract = new ExplorationEncounter(snapshot.spec);
    const pilotIds = new Set(contract.kills.keys());
    const actorIds = new Set([...contract.actors.keys()]);
    const uniquePairs = <T>(entries: Array<[string, T]>) => {
      const result = new Map<string, T>();
      for (const [key, value] of entries) {
        if (typeof key !== "string" || result.has(key)) throw new Error("Invalid exploration checkpoint.");
        result.set(key, value);
      }
      return result;
    };
    contract.damage.clear();
    for (const [targetId, contributors] of uniquePairs(snapshot.damage)) {
      if (!actorIds.has(targetId) || !Array.isArray(contributors) ||
          contributors.some((playerId) => !pilotIds.has(playerId))) {
        throw new Error("Invalid exploration checkpoint.");
      }
      contract.damage.set(targetId, new Set(contributors));
    }
    for (const [playerId, destroyed] of uniquePairs(snapshot.kills)) {
      if (!pilotIds.has(playerId) || !Array.isArray(destroyed) ||
          destroyed.some((actorId) => !actorIds.has(actorId))) {
        throw new Error("Invalid exploration checkpoint.");
      }
      contract.kills.set(playerId, [...destroyed]);
    }
    for (const [playerId, assists] of uniquePairs(snapshot.assists)) {
      if (!pilotIds.has(playerId) || !Number.isSafeInteger(assists) || assists < 0) {
        throw new Error("Invalid exploration checkpoint.");
      }
      contract.assists.set(playerId, assists);
    }
    for (const [eventId, fingerprint] of uniquePairs(snapshot.events)) {
      if (!/^[A-Za-z0-9_:-]{1,128}$/.test(eventId) ||
          !/^[a-f0-9]{64}$/.test(fingerprint)) {
        throw new Error("Invalid exploration checkpoint.");
      }
      contract.events.set(eventId, fingerprint);
    }
    if (contract.events.size > 100_000 ||
        (snapshot.finalization && (!Number.isSafeInteger(snapshot.finalization.finalTick) ||
          snapshot.finalization.finalTick < snapshot.tick ||
          !["completed", "aborted"].includes(snapshot.finalization.outcome) ||
          typeof snapshot.finalization.objectiveCompleted !== "boolean"))) {
      throw new Error("Invalid exploration checkpoint.");
    }
    contract.chain = snapshot.chain;
    contract.tick = snapshot.tick;
    if (snapshot.finalization) {
      contract.finalize(
        snapshot.finalization.finalTick,
        snapshot.finalization.outcome,
        snapshot.finalization.objectiveCompleted,
      );
      const result = contract.receipt && receipts.get(contract.receipt);
      if (!result || result.fingerprint !== snapshot.resultFingerprint) {
        throw new Error("Exploration checkpoint result fingerprint mismatch.");
      }
    } else if (snapshot.resultFingerprint !== undefined) {
      throw new Error("Invalid exploration checkpoint.");
    }
    return contract;
  }

  snapshot(): ExplorationEncounterSnapshotV1 {
    const result = this.receipt ? receipts.get(this.receipt) : undefined;
    return {
      version: 1,
      spec: structuredClone(this.spec),
      damage: [...this.damage].map(([targetId, players]) => [targetId, [...players].sort()]),
      kills: [...this.kills].map(([playerId, destroyed]) => [playerId, [...destroyed]]),
      assists: [...this.assists],
      events: [...this.events],
      chain: this.chain,
      tick: this.tick,
      ...(this.finalization ? { finalization: { ...this.finalization } } : {}),
      ...(result ? { resultFingerprint: result.fingerprint } : {}),
    };
  }

  /** Only the authenticated live runtime may extend an open patrol roster. */
  addPilot(actor: ExplorationActor, tick: number): boolean {
    if (this.receipt || this.spec.missionId !== "universe-patrol" || !this.spec.patrol) {
      throw new Error("Only an open universe patrol accepts assisting pilots.");
    }
    id(actor.id);
    if (!actor.playerId) throw new Error("Assisting pilot requires a server-owned player.");
    id(actor.playerId);
    integer(tick);
    if (tick < this.tick || actor.faction === this.spec.patrol.faction ||
        !["ussf", "accord"].includes(actor.faction) || actor.rewardEligible ||
        !Number.isFinite(actor.hull) || actor.hull <= 0 || actor.hull > 1_000_000) {
      throw new Error("Invalid assisting pilot.");
    }
    const existing = this.actors.get(actor.id);
    if (existing) {
      if (existing.playerId !== actor.playerId || existing.faction !== actor.faction) {
        throw new Error("Conflicting assisting pilot identity.");
      }
      return false;
    }
    if (this.kills.has(actor.playerId) || this.kills.size >= 8 || this.actors.size >= 128) {
      throw new Error("Invalid assisting pilot roster.");
    }
    this.actors.set(actor.id, { ...actor });
    this.kills.set(actor.playerId, []);
    this.assists.set(actor.playerId, 0);
    this.spec.actors = [...this.spec.actors, { ...actor }].sort((a, b) => a.id.localeCompare(b.id));
    this.tick = tick;
    this.chain = hash([this.chain, { type: "pilot_joined", tick, actor }]);
    return true;
  }

  /** Trusted runtime admission only; NPCs never become account participants. */
  addAlliedNpc(actor: ExplorationActor, tick: number): boolean {
    if (this.receipt || this.spec.missionId !== "universe-patrol" || !this.spec.patrol) {
      throw new Error("Only an open universe patrol accepts allied NPCs.");
    }
    id(actor.id);
    integer(tick);
    if (tick < this.tick || actor.playerId !== undefined || actor.rewardEligible === true ||
        !["ussf", "accord"].includes(actor.faction) || actor.faction === this.spec.patrol.faction ||
        !Number.isFinite(actor.hull) || actor.hull <= 0 || actor.hull > 1_000_000) {
      throw new Error("Invalid allied NPC.");
    }
    const existing = this.actors.get(actor.id);
    if (existing) {
      if (existing.playerId !== undefined || existing.faction !== actor.faction ||
          existing.rewardEligible === true) throw new Error("Conflicting allied NPC identity.");
      return false;
    }
    if (this.actors.size >= 128) throw new Error("Invalid allied NPC roster.");
    this.actors.set(actor.id, { ...actor, rewardEligible: false });
    this.spec.actors = [...this.spec.actors, { ...actor, rewardEligible: false }]
      .sort((a, b) => a.id.localeCompare(b.id));
    this.tick = tick;
    this.chain = hash([this.chain, { type: "allied_npc_joined", tick, actor }]);
    return true;
  }

  recordDamage(event: ServerDamageEvent): boolean {
    if (this.receipt) throw new Error("Exploration encounter already finalized.");
    id(event.eventId); integer(event.tick);
    const canonical = { eventId: event.eventId, tick: event.tick, attackerActorId: event.attackerActorId, targetActorId: event.targetActorId, hullDamage: event.hullDamage };
    const fingerprint = hash(canonical);
    const existing = this.events.get(event.eventId);
    if (existing) {
      if (existing !== fingerprint) throw new Error("Conflicting exploration event retry.");
      return false;
    }
    if (this.events.size >= 100_000 || event.tick < this.tick || !Number.isFinite(event.hullDamage) || event.hullDamage <= 0 || event.hullDamage > 1_000_000) {
      throw new Error("Invalid exploration damage event.");
    }
    const attacker = this.actors.get(event.attackerActorId);
    const target = this.actors.get(event.targetActorId);
    // A server-validated missile can arrive after its firing hull is destroyed.
    // Upstream physics owns projectile validity; target death is still one-shot.
    if (!attacker || !target || attacker === target || target.hull <= 0) throw new Error("Invalid exploration damage actors.");
    this.events.set(event.eventId, fingerprint);
    this.tick = event.tick;
    this.chain = hash([this.chain, canonical]);
    const hostile = attacker.faction !== target.faction;
    if (hostile && attacker.playerId) {
      const contributors = this.damage.get(target.id) ?? new Set<string>();
      contributors.add(attacker.playerId);
      this.damage.set(target.id, contributors);
    }
    target.hull = Math.max(0, target.hull - event.hullDamage);
    if (target.hull === 0 && hostile) {
      if (attacker.playerId) this.kills.get(attacker.playerId)!.push(target.id);
      for (const player of this.damage.get(target.id) ?? []) {
        if (player !== attacker.playerId) this.assists.set(player, (this.assists.get(player) ?? 0) + 1);
      }
    }
    return true;
  }

  finalize(finalTick: number, outcome: "completed" | "aborted", objectiveCompleted: boolean): ExplorationReceipt {
    integer(finalTick);
    if (this.receipt) {
      const previous = readExplorationReceipt(this.receipt);
      if (previous.finalTick !== finalTick || previous.outcome !== outcome || previous.objectiveCompleted !== objectiveCompleted) throw new Error("Conflicting encounter completion.");
      return this.receipt;
    }
    if (finalTick < this.tick || !["completed", "aborted"].includes(outcome) || typeof objectiveCompleted !== "boolean" || (outcome === "aborted" && objectiveCompleted)) throw new Error("Invalid encounter completion.");
    const policy = this.spec.rewardPolicy;
    const pilots = [...this.kills.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([playerId, destroyed]) => {
      const destroyedActorIds = Object.freeze([...destroyed].sort());
      const npcKills = destroyed.filter((actorId) => {
        const actor = this.actors.get(actorId)!;
        return !actor.playerId && actor.rewardEligible === true;
      }).length;
      const credits = outcome === "completed"
        ? Math.min(policy.maxCreditsPerEncounter, npcKills * policy.creditsPerNpcKill + (objectiveCompleted ? policy.completionCredits : 0))
        : 0;
      integer(credits);
      return Object.freeze({ playerId, kills: destroyed.length, assists: this.assists.get(playerId) ?? 0, destroyedActorIds, rewardableNpcKills: npcKills, credits });
    });
    const content = {
      version: EXPLORATION_CONTRACT, encounterId: this.spec.encounterId,
      missionId: this.spec.missionId ?? "pale-beacons",
      sectorId: this.spec.sectorId, runtime: this.spec.runtime, policyId: policy.id,
      rewardPolicy: Object.freeze({ ...policy }),
      ...(this.spec.patrol ? { patrol: Object.freeze({ ...this.spec.patrol }) } : {}),
      ...(this.spec.patrol ? {
        patrolDestroyedActorIds: Object.freeze([...this.actors.values()]
          .filter((actor) => actor.faction === this.spec.patrol!.faction &&
            actor.playerId === undefined && actor.hull === 0)
          .map((actor) => actor.id).sort()),
      } : {}),
      outcome, finalTick, objectiveCompleted, pilots: Object.freeze(pilots),
    };
    const result = Object.freeze({ ...content, fingerprint: hash([this.chain, content]) });
    this.finalization = { finalTick, outcome, objectiveCompleted };
    this.receipt = Object.freeze({ encounterId: this.spec.encounterId }) as ExplorationReceipt;
    receipts.set(this.receipt, result);
    return this.receipt;
  }
}
