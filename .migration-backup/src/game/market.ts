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

export function winBid(price: number): number {
  return Math.round(price * 1.35);
}

export function scrapValue(paid: number): number {
  return Math.round(paid * 0.4);
}

export function dockValue(paid: number): number {
  return Math.round(paid * 0.7);
}

export function drift(prices: Record<GoodId, number>, sold: GoodId | null): Record<GoodId, number> {
  const next = { ...prices };
  for (const good of GOODS) {
    const wobble = 0.9 + Math.random() * 0.22;
    const supply = sold === good.id ? 0.86 : 1;
    const raw = Math.round(next[good.id] * wobble * supply);
    const lo = Math.round(good.base * 0.55);
    const hi = Math.round(good.base * 1.9);
    next[good.id] = Math.max(lo, Math.min(hi, raw));
  }
  return next;
}

export function applyBuy<T extends { credits: number; hold: GoodId | null; paid: number; prices: Record<GoodId, number> }>(
  save: T,
  id: GoodId,
): T {
  if (save.hold) return save;
  const price = save.prices[id];
  if (!Number.isFinite(price) || price <= 0 || save.credits < price) return save;
  return { ...save, credits: save.credits - price, hold: id, paid: price };
}

export function applyDock<T extends { credits: number; hold: GoodId | null; paid: number }>(save: T): T {
  if (!save.hold) return save;
  return { ...save, credits: save.credits + dockValue(save.paid), hold: null, paid: 0 };
}
