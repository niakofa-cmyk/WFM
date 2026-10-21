import type { InventoryHolding, WorldState } from "@workspace/api-client-react";
import { RejectedEconomyRequests } from "./RejectedEconomyRequests";

export const repLabel = (value: number) => (value <= -50 ? "HOSTILE" : value >= 50 ? "ALLIED" : value >= 15 ? "FRIENDLY" : "NEUTRAL");
const names: Record<string, string> = { salt: "Solar salt", iron: "Void iron", dust: "Relic dust", resin: "Med resin" };
const goods = (items: InventoryHolding[]) => items.filter((i) => i.quantity > 0).map((i) => `${i.quantity} ${names[i.goodId] ?? i.goodId}`).join(", ");
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString()} CR`;

type Props = { world: WorldState; blocked: boolean; onRun: (serviceId: string, locationId: string, title: string) => void };

export function UniverseActivities({ world, blocked, onRun }: Props) {
  const here = world.locations.find((l) => l.id === world.currentLocation);
  const held = goods(world.inventory);
  const history = [...world.history].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 8);
  return (
    <section data-testid="panel-activities" className="border border-solar/30 bg-panel/65">
      <div className="border-b border-bone/10 px-4 py-4">
        <p className="font-hud text-xs tracking-[0.2em] text-solar">STATION ACTIVITIES</p>
        <h2 className="mt-1 font-hud text-2xl">{here?.name ?? "Position unconfirmed"}</h2>
        <p className="mt-1 text-xs text-muted">Hyperdrive tier {world.hyperdriveTier} of 3. Cargo: {held || "empty"}.</p>
        <p data-testid="text-station-cargo" className="mt-2 font-hud text-sm tracking-widest text-solar">HOLD {world.cargoUsed}/{world.cargoCapacity} UNITS</p>
        <p data-testid="text-installed-upgrades" className="mt-1 text-xs text-bone/80">Installed: {world.installedUpgrades.length ? world.installedUpgrades.map((id) => id.replaceAll("-", " ")).join(" · ") : "No specialist upgrades"}</p>
      </div>
      <RejectedEconomyRequests rows={world.rejections} />
      {world.activities.length === 0 ? (
        <p className="m-3 border border-dashed border-bone/15 px-4 py-6 text-sm text-muted">No activities are offered at this location. Travel to a station or salvage site.</p>
      ) : (
        <div className="divide-y divide-bone/10">
          {world.activities.map((a) => (
            <article key={a.id} data-testid={`card-activity-${a.id}`} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-hud text-lg leading-tight">{a.title}</h3>
                <span className="shrink-0 text-[9px] tracking-widest text-muted">{a.daily ? "DAILY / " : ""}RISK {a.risk.toUpperCase()}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{a.description}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] tracking-wider text-bone/70">
                {a.creditCost > 0 ? <span>COST {a.creditCost.toLocaleString()} CR</span> : null}
                {goods(a.costs) ? <span>CONSUMES {goods(a.costs)}</span> : null}
                {a.rewardCredits > 0 ? <span>PAYS {a.rewardCredits.toLocaleString()} CR</span> : null}
                {goods(a.rewards) ? <span>YIELDS {goods(a.rewards)}</span> : null}
                {a.reputationDelta !== 0 ? <span>STANDING {a.reputationDelta > 0 ? "+" : ""}{a.reputationDelta}</span> : null}
                {a.rivalReputationDelta !== 0 ? <span>RIVAL {a.rivalReputationDelta > 0 ? "+" : ""}{a.rivalReputationDelta}</span> : null}
              </div>
              {!a.available && a.reason ? <p className="mt-2 border-l border-alert/40 pl-2 text-[10px] tracking-widest text-muted">{a.reason.toUpperCase()}</p> : null}
              <button type="button" data-testid={`button-activity-${a.id}`} disabled={!a.available || blocked || !here}
                onClick={() => here && onRun(a.id, here.id, a.title)}
                className="mt-3 h-10 w-full bg-solar font-hud text-xs tracking-widest text-void disabled:border disabled:border-bone/10 disabled:bg-transparent disabled:text-muted sm:w-auto sm:px-6">
                {a.available ? "EXECUTE" : "UNAVAILABLE"}
              </button>
            </article>
          ))}
        </div>
      )}
      <div className="border-t border-bone/10 px-4 py-3">
        <p className="font-hud text-xs tracking-[0.2em] text-solar">ACTIVITY LEDGER</p>
        {history.length === 0 ? <p className="mt-2 text-sm text-muted">No activity recorded yet.</p> : (
          <ul className="mt-2 divide-y divide-bone/10">
            {history.map((h) => (
              <li key={h.id} data-testid={`row-history-${h.id}`} className="flex justify-between gap-3 py-2 text-xs">
                <span className="text-bone">{h.title}</span>
                <span className="font-mono text-muted">{signed(h.creditsDelta)} · {new Date(h.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
