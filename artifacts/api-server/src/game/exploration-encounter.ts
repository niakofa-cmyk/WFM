import { createHash } from "node:crypto";
import { ORBITAL_RUNTIME_ID } from "@workspace/orbital-sim";

export const EXPLORATION_CONTRACT = "orbital-exploration-v1" as const;
type Faction = "ussf" | "accord";
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
  sectorId: string;
  runtime: typeof ORBITAL_RUNTIME_ID;
  authority: "server";
  mode: "universe-exploration";
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
  sectorId: string;
  runtime: typeof ORBITAL_RUNTIME_ID;
  policyId: string;
  rewardPolicy: Readonly<ExplorationPolicy>;
  fingerprint: string;
  outcome: "completed" | "aborted";
  finalTick: number;
  objectiveCompleted: boolean;
  pilots: readonly Readonly<ExplorationPilotResult>[];
};
declare const receiptBrand: unique symbol;
export type ExplorationReceipt = Readonly<{
  encounterId: string;
  [receiptBrand]: true;
}>;

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

  constructor(spec: ExplorationEncounterSpec) {
    id(spec.encounterId); id(spec.sectorId); id(spec.rewardPolicy.id);
    if (spec.authority !== "server" || spec.mode !== "universe-exploration" || spec.runtime !== ORBITAL_RUNTIME_ID) {
      throw new Error("Unsupported exploration authority, mode or runtime.");
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
      sectorId: this.spec.sectorId, runtime: this.spec.runtime, policyId: policy.id,
      rewardPolicy: Object.freeze({ ...policy }),
      outcome, finalTick, objectiveCompleted, pilots: Object.freeze(pilots),
    };
    const result = Object.freeze({ ...content, fingerprint: hash([this.chain, content]) });
    this.receipt = Object.freeze({ encounterId: this.spec.encounterId }) as ExplorationReceipt;
    receipts.set(this.receipt, result);
    return this.receipt;
  }
}
