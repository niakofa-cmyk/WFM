import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMarketQueryKey,
  useGetMarket,
  useTradeMarket,
  type MarketListing,
  type MarketTransaction,
} from "@workspace/api-client-react";

const money = (value: number) => `${value.toLocaleString()} CR`;
const itemNames: Record<string, string> = {
  salt: "Solar salt",
  iron: "Void iron",
  dust: "Relic dust",
  resin: "Med resin",
};
function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Trade could not be completed. Try again.";
}

export function MarketPanel({ onCredits }: { onCredits: (credits: number) => void }) {
  const queryClient = useQueryClient();
  const marketQuery = useGetMarket({ query: { refetchInterval: 5000, queryKey: getGetMarketQueryKey() } });
  const trade = useTradeMarket();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [tradeError, setTradeError] = useState("");
  const requestKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const market = marketQuery.data;

  const transact = async (listing: MarketListing, side: "buy" | "sell", quantity: number) => {
    if (!market || trade.isPending) return;
    setTradeError("");
    const fingerprint = `${listing.goodId}:${side}:${quantity}`;
    const idempotencyKey =
      requestKeyRef.current?.fingerprint === fingerprint
        ? requestKeyRef.current.key
        : crypto.randomUUID();
    requestKeyRef.current = { fingerprint, key: idempotencyKey };
    try {
      const result = await trade.mutateAsync({
        data: { idempotencyKey, goodId: listing.goodId, side, quantity },
      });
      requestKeyRef.current = null;
      onCredits(result.market.credits);
      await queryClient.invalidateQueries({ queryKey: getGetMarketQueryKey() });
    } catch (error) {
      setTradeError(errorText(error));
    }
  };

  useEffect(() => {
    if (market) onCredits(market.credits);
  }, [market?.credits, onCredits]);

  if (marketQuery.isLoading) {
    return <section className="animate-pulse border border-bone/15 bg-panel/80 p-4" aria-label="Loading station market">
      <div className="h-5 w-40 bg-bone/10" /><div className="mt-4 h-28 bg-bone/5" /><div className="mt-3 h-16 bg-bone/5" />
    </section>;
  }
  if (marketQuery.isError || !market) {
    return <section className="border border-alert/50 bg-alert/10 p-4">
      <p className="font-hud text-sm tracking-widest text-alert">MARKET SIGNAL LOST</p>
      <p className="mt-1 text-sm text-muted">The Phobos exchange is unavailable. Your ledger has not been changed.</p>
      <button type="button" data-testid="button-retry-market" onClick={() => void marketQuery.refetch()} className="mt-3 h-10 border border-bone/30 px-4 font-hud tracking-widest text-bone">RETRY</button>
    </section>;
  }

  const holding = (goodId: string) => market.inventory.find((item) => item.goodId === goodId)?.quantity ?? 0;
  const transactionRows: MarketTransaction[] = [...market.transactions]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 6);

  return (
    <section className="border border-solar/30 bg-panel/90">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-bone/10 px-4 py-4">
        <div>
          <p className="font-hud text-xs tracking-[0.22em] text-solar">PHOBOS SHARED EXCHANGE</p>
          <h2 className="mt-1 font-hud text-2xl leading-none text-bone">Station market</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">Quotes respond to station supply, recent buying and selling, and the active world event. Each trade updates the shared market.</p>
        </div>
        <div className="min-w-32 border-l-2 border-solar pl-3">
          <p className="text-[10px] tracking-[0.18em] text-muted">ACCOUNT LEDGER</p>
          <p data-testid="text-market-credits" className="font-hud text-xl text-solar">{money(market.credits)}</p>
        </div>
      </div>
      <div className="border-b border-bone/10 bg-solar/5 px-4 py-3">
          <p className="font-hud text-[10px] tracking-[0.2em] text-solar">MARKET CYCLE · {new Date(market.event.cycleDate).toLocaleDateString()}</p>
        <p className="mt-1 font-hud text-lg text-bone">{market.event.title}</p>
        <p className="text-xs leading-relaxed text-muted">{market.event.description}</p>
      </div>
      {market.listings.length === 0 ? (
        <p className="m-3 border border-dashed border-bone/15 px-4 py-6 text-sm text-muted">The exchange has no listings in this market cycle.</p>
      ) : <div className="grid gap-2 p-3 sm:grid-cols-2">
        {market.listings.map((listing) => {
          const quantity = Math.min(50, Math.max(1, quantities[listing.goodId] ?? 1));
          const held = holding(listing.goodId);
          const buyTotal = listing.price * quantity;
          const sellTotal = buyTotal;
          const canBuy = listing.stock >= quantity && market.credits >= buyTotal;
          const canSell = held >= quantity;
          const eventPercent = Math.round((listing.modifierBps - 10_000) / 100);
          return (
            <article key={listing.goodId} data-testid={`card-market-good-${listing.goodId}`} className="border border-bone/12 bg-void/45 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-hud text-lg text-bone">{listing.name || itemNames[listing.goodId] || listing.goodId}</p>
                  <p className="text-xs text-muted">{listing.stock.toLocaleString()} available · you hold {held.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-hud text-xl text-solar">{money(listing.price)}</p>
                  <p className="text-[10px] tracking-widest text-muted">PER UNIT</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-bone/10 pt-3">
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`market-quantity-${listing.goodId}`}>Quantity for {listing.name}</label>
                  <button type="button" aria-label={`Decrease ${listing.name} quantity`} disabled={quantity <= 1 || trade.isPending} onClick={() => setQuantities((current) => ({ ...current, [listing.goodId]: quantity - 1 }))} className="h-9 w-9 border border-bone/25 text-bone disabled:opacity-40">−</button>
                  <input
                    id={`market-quantity-${listing.goodId}`}
                    data-testid={`input-market-quantity-${listing.goodId}`}
                    type="number"
                    min={1}
                    max={50}
                    value={quantity}
                    onChange={(event) => {
                      const next = Math.floor(Number(event.target.value));
                      setQuantities((current) => ({ ...current, [listing.goodId]: Math.min(50, Math.max(1, Number.isFinite(next) ? next : 1)) }));
                    }}
                    className="h-9 w-14 border border-bone/25 bg-void px-2 text-center font-mono text-sm text-bone"
                  />
                  <button type="button" aria-label={`Increase ${listing.name} quantity`} disabled={quantity >= 50 || trade.isPending} onClick={() => setQuantities((current) => ({ ...current, [listing.goodId]: quantity + 1 }))} className="h-9 w-9 border border-bone/25 text-bone disabled:opacity-40">+</button>
                </div>
                <div className="flex gap-2">
                  <button type="button" data-testid={`button-buy-${listing.goodId}`} disabled={!canBuy || trade.isPending} onClick={() => void transact(listing, "buy", quantity)} className="h-9 bg-solar px-3 font-hud text-xs tracking-widest text-void disabled:opacity-35">{trade.isPending ? "WORKING" : `BUY ${money(buyTotal)}`}</button>
                  <button type="button" data-testid={`button-sell-${listing.goodId}`} disabled={!canSell || trade.isPending} onClick={() => void transact(listing, "sell", quantity)} className="h-9 border border-bone/30 px-3 font-hud text-xs tracking-widest text-bone disabled:opacity-35">SELL +{money(sellTotal)}</button>
                </div>
              </div>
              <div className="mt-2 flex justify-between text-[10px] tracking-wider text-muted">
                <span>SUPPLY {listing.stock}/{listing.targetStock} · DEMAND {listing.demandScore > 0 ? "+" : ""}{listing.demandScore}</span>
                <span>{eventPercent === 0 ? "EVENT BASE" : `EVENT ${eventPercent > 0 ? "+" : ""}${eventPercent}%`}</span>
                <span>MARKET REV {listing.revision}</span>
              </div>
            </article>
          );
        })}
      </div>}
      {tradeError ? <p role="alert" data-testid="status-market-error" className="mx-3 mb-3 border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-bone">{tradeError}</p> : null}
      <div className="border-t border-bone/10 px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-hud text-sm tracking-[0.18em] text-solar">RECENT LEDGER</p>
          <p className="text-[10px] tracking-widest text-muted">LIVE · REFRESH 5 SEC</p>
        </div>
        {transactionRows.length === 0 ? (
          <p className="mt-3 border border-dashed border-bone/15 px-3 py-4 text-sm text-muted">No market transactions recorded for this account yet.</p>
        ) : (
          <div className="mt-2 divide-y divide-bone/10">
            {transactionRows.map((tx) => (
              <div key={tx.id} data-testid={`row-market-transaction-${tx.id}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-xs">
                <div><span className={tx.side === "buy" ? "font-hud tracking-wider text-alert" : "font-hud tracking-wider text-solar"}>{tx.side.toUpperCase()}</span><span className="ml-2 text-bone">{itemNames[tx.goodId] ?? tx.goodId} × {tx.quantity}</span></div>
                <div className="flex gap-4 font-mono text-muted"><span>{money(tx.total)}</span><span>{new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
