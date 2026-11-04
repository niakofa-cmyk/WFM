import assert from "node:assert/strict";
import test from "node:test";
import { orderUnitPrice } from "./market-pricing";
test("unchanged-world round trips cannot generate credits across quantity, supply, demand, event and clamp boundaries", () => {
  for (const basePrice of [1, 40, 55, 110]) for (const stock of [1, 50, 100, 900]) {
    for (const demandScore of [-100, -99, -10, 0, 99, 100]) for (const modifier of [5000, 9000, 10000, 10500, 12000, 20000]) {
      for (const quantity of [1, 5, 50]) {
        const state = { basePrice, stock, demandScore, targetStock: 100 };
        if (stock >= quantity) {
          const ask = orderUnitPrice(state, modifier, "buy", quantity);
          const after = { ...state, stock: stock - quantity, demandScore: Math.min(100, demandScore + 2 * quantity) };
          const bid = orderUnitPrice(after, modifier, "sell", quantity);
          assert.ok(ask >= bid, JSON.stringify({ state, modifier, quantity, ask, bid }));
        }
        const bid = orderUnitPrice(state, modifier, "sell", quantity);
        const after = { ...state, stock: stock + quantity, demandScore: Math.max(-100, demandScore - 2 * quantity) };
        const ask = orderUnitPrice(after, modifier, "buy", quantity);
        assert.ok(ask >= bid);
        assert.ok(Number.isInteger(ask) && Number.isInteger(bid) && bid >= 1);
      }
    }
  }
});
