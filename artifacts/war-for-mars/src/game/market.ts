export const GOODS = [
  { id: "salt", name: "Solar salt", base: 40 },
  { id: "iron", name: "Void iron", base: 70 },
  { id: "dust", name: "Relic dust", base: 110 },
  { id: "resin", name: "Med resin", base: 55 },
] as const;

export type GoodId = (typeof GOODS)[number]["id"];

export function isGood(id: string | null | undefined): id is GoodId {
  return GOODS.some((good) => good.id === id);
}

export function goodName(id: GoodId): string {
  return GOODS.find((good) => good.id === id)?.name ?? id;
}

export function basePrices(): Record<GoodId, number> {
  return { salt: 40, iron: 70, dust: 110, resin: 55 };
}
