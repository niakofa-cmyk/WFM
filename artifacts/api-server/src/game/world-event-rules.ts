import type { TradeGoodId } from "@workspace/db";
export function worldEventRules(eventId: string) {
  if (eventId === "relay-boom") return {
    contractBps: 13000, salvageBonus: 0, remoteFare: 0, rivalPenalty: 0,
    restrictedGoods: [] as TradeGoodId[],
    stockDelta: { salt: -10, iron: -8 } as Partial<Record<TradeGoodId, number>>,
    summary: "Dispatch payouts +30%; this cycle consumes 10 salt and 8 iron from shared supply.",
  };
  if (eventId === "dust-embargo") return {
    contractBps: 10000, salvageBonus: 0, remoteFare: 10, rivalPenalty: -2,
    restrictedGoods: ["dust"] as TradeGoodId[],
    stockDelta: { dust: -8, resin: -10 } as Partial<Record<TradeGoodId, number>>,
    summary: "Relic dust exchange trading suspended this UTC cycle (official crafting/deliveries remain allowed). Outer/Deep fares +10 CR; remote salvage costs 2 rival standing; shared dust/resin supplies contract.",
  };
  return {
    contractBps: 10000, salvageBonus: 2, remoteFare: 0, rivalPenalty: 0,
    restrictedGoods: [] as TradeGoodId[],
    stockDelta: { iron: 20, resin: 10 } as Partial<Record<TradeGoodId, number>>,
    summary: "Salvage yields +2 iron; shared supply gains 20 iron and 10 resin on cycle activation.",
  };
}
