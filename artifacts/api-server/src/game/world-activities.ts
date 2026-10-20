import type { WorldActivity } from "@workspace/api-zod";
import type { TradeGoodId } from "@workspace/db";
import { worldEventRules } from "./world-event-rules";
type Materials = Partial<Record<TradeGoodId, number>>;
type Definition = {
  id: string; title: string; description: string; daily?: boolean; creditCost?: number; rewardCredits?: number;
  costs?: Materials; rewards?: Materials; reputationDelta?: number; rivalReputationDelta?: number; requiredRep?: number; reason?: string;
};
const holdings = (items: Materials = {}) => Object.entries(items).map(([goodId, quantity]) => ({ goodId: goodId as TradeGoodId, quantity: quantity! }));
export function buildActivities(context: {
  locationId: string; eventId: string; refit: number; tier: number; standing: number; credits: number;
  inventory: { goodId: string; quantity: number }[]; completed: Set<string>;
  explored: boolean;
}): WorldActivity[] {
  const { locationId, refit, tier, standing } = context;
  const event = worldEventRules(context.eventId);
  const definitions: Definition[] = [];
  if (["rust-disc", "dust-lane", "outer-fringe"].includes(locationId)) definitions.push({
    id: "salvage", title: "Survey the wreck field", daily: true,
    description: "Recover a finite surveyed cache. A new cache is charted each UTC cycle.",
    rewards: { iron: (locationId === "rust-disc" ? 3 : 6) + event.salvageBonus, salt: 2, dust: 1 },
    reputationDelta: 2, rivalReputationDelta: locationId === "rust-disc" ? 0 : event.rivalPenalty,
  });
  if (locationId === "phobos-yard") definitions.push(
    { id: "amnesty", title: "Diplomatic restitution", description: "Pay 80 CR to repair ten points of your faction standing, including when hostile. Return routes to Phobos stay open.", creditCost: 80, reputationDelta: 10, reason: standing >= 0 ? "No restitution is needed." : undefined },
    { id: "refine", title: "Refinery: concentrate relic dust", description: "Consume iron and solar catalyst to produce a hyperdrive/research material.", costs: { iron: 2, salt: 1 }, rewards: { dust: 1 } },
    { id: "material-refit", title: `Material refit ${Math.min(5, refit + 1)}`, description: "Materials halve the standard credit fare. Each level grants +6% hull/shields and +4% weapon damage in solo combat.", costs: { iron: 2, resin: 1, salt: 1 }, creditCost: 60 * (refit + 1), reason: refit >= 5 ? "Refit already at level 5." : undefined },
    { id: "hyperdrive", title: `Hyperdrive tier ${Math.min(3, tier + 1)}`, description: "Permanently chart higher-tier routes. Reputation gates still apply.", costs: { iron: 3 * tier, dust: 2 * tier, salt: 2 }, creditCost: 100 * tier, reason: tier >= 3 ? "Hyperdrive already at tier 3." : undefined },
    { id: "relief-contract", title: "Dispatch: relief supplies", description: "Deliver catalyst and medicine into the shared station supply.", daily: true, costs: { salt: 2, resin: 1 }, rewardCredits: Math.floor(70 * event.contractBps / 10000), reputationDelta: 4, rivalReputationDelta: 1 },
  );
  if (locationId === "phobos-yard") definitions.push({
    id: `event-${context.eventId}-contract`, title: context.eventId === "relay-boom" ? "Surge contract: relay catalyst" : context.eventId === "dust-embargo" ? "Embargo contract: relief medicine" : "Bounty contract: recovered metal",
    description: "Today's dispatch is generated from the live theater event. It expires at the next UTC cycle.",
    daily: true,
    costs: context.eventId === "relay-boom" ? { salt: 3 } : context.eventId === "dust-embargo" ? { resin: 1, dust: 1 } : { iron: 3 },
    rewardCredits: Math.floor(170 * event.contractBps / 10000), reputationDelta: 5, rivalReputationDelta: 1,
  });
  if (locationId === "pale-beacons") definitions.push({
    id: "beacon-service", title: "Service the beacon chain", description: "Fuel the navigation network and earn both factions' trust.", daily: true, costs: { salt: 2 }, rewardCredits: Math.floor(45 * event.contractBps / 10000), reputationDelta: 4, rivalReputationDelta: 2,
  });
  if (locationId === "night-side") definitions.push({
    id: "medical-contract", title: "Warden medical dispatch", description: "Break the station quarantine with verified medical supplies.", daily: true, costs: { resin: 2 }, rewardCredits: Math.floor(120 * event.contractBps / 10000), reputationDelta: 4, rivalReputationDelta: 2,
  });
  if (["mars-signal", "deep-nebula"].includes(locationId)) definitions.push({
    id: "research", title: "Signal research: synthesize resin", description: "Analyze relic dust with solar catalyst; produce medical resin and log verified research standing.", daily: true, costs: { dust: 1, salt: 2 }, rewards: { resin: 4 }, reputationDelta: 5, rivalReputationDelta: 1,
  });
  if (["outer-fringe", "deep-nebula"].includes(locationId)) definitions.push({
    id: "faction-contract", title: "Faction supply operation", description: "Back your faction's frontier fleet. The rival faction treats the delivery as a hostile act.", daily: true, requiredRep: 25, costs: { iron: 2, resin: 2 }, rewardCredits: Math.floor(200 * event.contractBps / 10000), reputationDelta: 5, rivalReputationDelta: -5,
  });
  if (locationId === "deep-nebula") definitions.push({
    id: "black-market", title: "Restricted broker: contraband sale", description: "Sell sensitive supplies for credits. Both factions lose trust; falling below 50 closes Deep Nebula services until standing is repaired.", daily: true, costs: { dust: 2, resin: 3 }, rewardCredits: 550, reputationDelta: -5, rivalReputationDelta: -5,
  });
  return definitions.map((def) => {
    const costs = holdings(def.costs);
    const reason = def.reason
      ?? (def.id === "salvage" && !context.explored ? "Log this location's discovery before surveying its salvage." : null)
      ?? (standing <= -50 && def.id !== "amnesty" ? "Hostile standing: use diplomatic restitution at Phobos." : null)
      ?? (standing < (def.requiredRep ?? -100) ? `${def.requiredRep} faction standing required.` : null)
      ?? (locationId === "outer-fringe" && standing < 10 ? "10 faction standing required for frontier services." : null)
      ?? (locationId === "deep-nebula" && standing < 50 ? "50 faction standing required." : null)
      ?? (def.daily && context.completed.has(def.id) ? "Completed this UTC cycle." : null)
      ?? (context.credits < (def.creditCost ?? 0) ? "Insufficient credits." : null)
      ?? (costs.some((cost) => (context.inventory.find((item) => item.goodId === cost.goodId)?.quantity ?? 0) < cost.quantity) ? "Required materials missing. Salvage or visit a market." : null);
    const rival = def.rivalReputationDelta ?? 0;
    return {
      id: def.id, title: def.title, description: def.description, daily: Boolean(def.daily),
      creditCost: def.creditCost ?? 0, rewardCredits: def.rewardCredits ?? 0, costs, rewards: holdings(def.rewards),
      reputationDelta: def.reputationDelta ?? 0, rivalReputationDelta: rival,
      risk: rival < 0 ? `Rival standing ${rival}; own standing ${def.reputationDelta ?? 0}.` : "No hostile standing consequence.",
      available: !reason, reason,
    };
  });
}
