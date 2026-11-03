type QuoteState = { basePrice: number; stock: number; targetStock: number; demandScore: number };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function referenceQuote(good: QuoteState, modifierBps: number) {
  const supply = clamp((good.targetStock - good.stock) / good.targetStock, -0.5, 1);
  const multiplier = clamp(1 + supply * .45 + good.demandScore / 100 * .25, .5, 2);
  return clamp(Math.round(good.basePrice * multiplier * modifierBps / 10000), Math.ceil(good.basePrice * .5), Math.floor(good.basePrice * 2));
}
/** Charge the worst affected quote for a bulk order, with an explicit bid/ask spread.
 * A buy followed by a sale cannot monetize the price impact of that same buy. */
export function orderUnitPrice(good: QuoteState, modifierBps: number, side: "buy" | "sell", quantity: number) {
  const direction = side === "buy" ? 1 : -1;
  const after = { ...good, stock: good.stock - direction * quantity, demandScore: clamp(good.demandScore + direction * quantity * 2, -100, 100) };
  const beforePrice = referenceQuote(good, modifierBps);
  const afterPrice = referenceQuote(after, modifierBps);
  const spread = Math.max(1, Math.ceil(good.basePrice * .02));
  return side === "buy" ? Math.max(beforePrice, afterPrice) + spread : Math.max(1, Math.min(beforePrice, afterPrice) - spread);
}
