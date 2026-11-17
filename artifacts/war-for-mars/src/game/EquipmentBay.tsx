import { useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetEquipment, useFitEquipment, useRecoverEquipment,
  type EquipmentDefinition, type EquipmentHardpoint, type EquipmentItem, type EquipmentLocker,
} from "@workspace/api-client-react";
import { validateEquipmentFit } from "@workspace/orbital-sim";
import "./equipment-bay.css";

const STATS: [keyof EquipmentDefinition, string, string][] = [
  ["size", "MOUNT SIZE", ""], ["mass", "MASS", "t"], ["power", "POWER", "u"], ["damage", "DAMAGE", ""],
  ["ammunition", "AMMUNITION", ""], ["magazine", "MAGAZINE", ""], ["roundsPerMinute", "CADENCE", "rpm"],
  ["range", "RANGE", "m"], ["projectileVelocity", "VELOCITY", "m/s"], ["tracking", "TRACKING", ""],
  ["lockSeconds", "LOCK", "s"], ["reloadSeconds", "RELOAD", "s"], ["heat", "HEAT", ""],
  ["durability", "DURABILITY", ""], ["energy", "ENERGY", ""],
];
const STOCK: Record<string, string> = {
  primary: "Stock hull backup primary remains active.",
  secondary: "Stock hull backup secondary remains active.",
};

function status(e: unknown) { return (e as { status?: number } | null)?.status; }
function message(e: unknown, fallback: string) {
  const s = status(e);
  const detail = (e as { data?: { error?: unknown } } | null)?.data?.error;
  if (typeof detail === "string") return detail;
  if (s === 409) return "Locker changed elsewhere. Latest record reloaded; review and try again.";
  if (s === 401 || s === 403) return "Session not authorized. Sign in again.";
  return e instanceof Error && e.message ? `${fallback} (${e.message})` : fallback;
}

export function EquipmentBay({ shipId, signedIn }: { shipId: string; signedIn: boolean }) {
  const { userId, isSignedIn } = useAuth();
  const enabled = signedIn && !!isSignedIn && !!userId;
  const queryKey = useMemo(() => ["/api/game/equipment", userId ?? "anon"] as const, [userId]);
  const client = useQueryClient();
  const userRef = useRef(userId); userRef.current = userId;
  const q = useGetEquipment({ query: { queryKey, enabled, staleTime: 20_000, refetchOnMount: "always" } });
  const fit = useFitEquipment();
  const recover = useRecoverEquipment();
  const [slotId, setSlotId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const pending = fit.isPending || recover.isPending;

  const settle = (owner: string | null | undefined, key: typeof queryKey) => ({
    onSuccess: (locker: EquipmentLocker) => {
      if (owner !== userRef.current) return; // late response for a different account
      client.setQueryData(key, locker);
    },
    onError: (e: unknown) => {
      if (owner !== userRef.current) return;
      if (status(e) === 409) void client.invalidateQueries({ queryKey: key });
    },
  });

  if (!enabled) return (
    <section className="eqb eqb-state" data-testid="equipment-bay-signed-out">
      <p className="eqb-kicker">EQUIPMENT BAY · LOCKED</p>
      <p>Sign in to inspect your hull fittings and recovered salvage.</p>
    </section>
  );
  if (q.isLoading) return (
    <section className="eqb" aria-busy="true" data-testid="equipment-bay-loading">
      <p className="eqb-kicker">EQUIPMENT BAY · SYNCING LOCKER</p>
      <div className="eqb-skel-grid">{Array.from({ length: 6 }, (_, i) => <span key={i} className="eqb-skel" />)}</div>
    </section>
  );
  if (q.isError || !q.data) return (
    <section className="eqb eqb-state" role="alert" data-testid="equipment-bay-error">
      <p className="eqb-kicker eqb-alert">EQUIPMENT LOCKER UNREACHABLE</p>
      <p>{message(q.error, "Could not load the equipment record.")}</p>
      <button type="button" className="eqb-btn" data-testid="button-equipment-retry" onClick={() => void q.refetch()}>RETRY</button>
    </section>
  );

  const locker = q.data;
  const defs = new Map(locker.catalog.map(d => [d.id, d]));
  const hull = locker.hulls.find(h => h.shipId === shipId);
  const fitted = locker.items.filter(i => i.shipId === shipId && i.hardpointId);
  const mass = fitted.reduce((s, i) => s + (defs.get(i.equipmentId)?.mass ?? 0), 0);
  const power = fitted.reduce((s, i) => s + (defs.get(i.equipmentId)?.power ?? 0), 0);
  const slot = hull?.hardpoints.find(h => h.id === slotId) ?? null;
  const inSlot = (h: EquipmentHardpoint) => fitted.find(i => i.hardpointId === h.id);

  const reasons = (item: EquipmentItem, h: EquipmentHardpoint): string[] => {
    const d = defs.get(item.equipmentId);
    if (!d) return ["Unknown module record."];
    const out: string[] = [];
    if (d.kind !== h.kind) out.push(`${d.kind} module; mount takes ${h.kind}.`);
    if (d.size > h.size) out.push(`Needs size ${d.size} mount; this is size ${h.size}.`);
    if (item.condition <= 0) out.push("Module not serviceable.");
    if (item.shipId && !(item.shipId === shipId && item.hardpointId === h.id))
      out.push(`Fitted to ${item.shipId.toUpperCase()} / ${item.hardpointId}. Unequip it there first; modules never move automatically between mounts.`);
    if (out.length) return out;
    const next = fitted.filter(i => i.hardpointId !== h.id && i.id !== item.id)
      .map(i => ({ instanceId: i.id, equipmentId: i.equipmentId, hardpointId: i.hardpointId!, condition: i.condition }));
    next.push({ instanceId: item.id, equipmentId: item.equipmentId, hardpointId: h.id, condition: item.condition });
    try { const r = validateEquipmentFit(shipId, next); if (r) out.push(r); } catch { /* server authoritative */ }
    return out;
  };

  const doFit = (h: Pick<EquipmentHardpoint, "id">, itemId: string | null, label: string, targetShip: string = shipId) => {
    setNotice(null);
    const owner = userId, key = queryKey;
    const s = settle(owner, key);
    fit.mutate({ data: { shipId: targetShip, hardpointId: h.id, itemId, expectedRevision: locker.revision } }, {
      onSuccess: l => { s.onSuccess(l); if (owner === userRef.current) setNotice({ tone: "ok", text: `${label}. Applies to your next newly issued shared-universe flight.` }); },
      onError: e => { s.onError(e); if (owner === userRef.current) setNotice({ tone: "err", text: message(e, "Fit rejected by fleet command.") }); },
    });
  };
  const doRecover = (eventId: string, actorId: string) => {
    setNotice(null);
    const owner = userId, key = queryKey;
    const s = settle(owner, key);
    recover.mutate({ data: { eventId, actorId } }, {
      onSuccess: l => { s.onSuccess(l); if (owner === userRef.current) setNotice({ tone: "ok", text: "Salvage package recovered into your locker." }); },
      onError: e => { s.onError(e); if (owner === userRef.current) setNotice({ tone: "err", text: message(e, "Recovery rejected.") }); },
    });
  };

  return (
    <section className="eqb" data-testid="equipment-bay" aria-busy={pending}>
      <header className="eqb-head">
        <div>
          <p className="eqb-kicker">EQUIPMENT BAY · REV {locker.revision}</p>
          <h4>HARDPOINT FITTING</h4>
        </div>
        {hull ? (
          <div className="eqb-budgets">
            <Budget label="MASS" used={mass} limit={hull.massLimit} unit="t" />
            <Budget label="REACTOR" used={power} limit={hull.powerLimit} unit="u" />
          </div>
        ) : null}
      </header>
      <p className="eqb-note">
        A module fitted anywhere, on any hull, must be unequipped before it can be mounted elsewhere.
        Special adapters require a compatible weapon: plasma and EMP need a fitted primary modular gun, warhead adapters need a fitted secondary weapon.
        Unfitted primary and secondary mounts fall back to the stock hull backup weapons. Empty optional mounts stay inactive.
        Changes take effect on your <b>next newly issued shared-universe flight</b>; nothing hot-swaps mid-battle or in normalized competitive arenas.
      </p>
      {notice ? <p role={notice.tone === "err" ? "alert" : "status"} className={`eqb-notice is-${notice.tone}`} data-testid="status-equipment">{notice.text}</p> : null}

      {!hull ? <p className="eqb-state" data-testid="text-equipment-no-hull">This airframe has no equipment hardpoint record.</p> : (
        <div className="eqb-layout">
          <ol className="eqb-mounts" aria-label="Hull hardpoints">
            {hull.hardpoints.map(h => {
              const it = inSlot(h), d = it && defs.get(it.equipmentId);
              return (
                <li key={h.id}>
                  <button type="button" aria-pressed={slotId === h.id} data-testid={`button-hardpoint-${h.id}`}
                    className="eqb-mount" onClick={() => setSlotId(slotId === h.id ? null : h.id)}>
                    <span className="eqb-mount-tag">{h.kind.toUpperCase()} · S{h.size}</span>
                    <b>{d ? d.name : "EMPTY"}</b>
                    <small>{it ? `Condition ${it.condition}/${d?.durability ?? "?"}` : STOCK[h.kind] ?? (h.kind === "special" ? "Inactive. Adapters need a compatible fitted weapon." : "Inactive mount.")}</small>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="eqb-detail">
            {!slot ? <p className="eqb-state">Select a hardpoint to review compatible modules from your locker.</p> : (
              <>
                <div className="eqb-detail-head">
                  <p className="eqb-kicker">{slot.id.toUpperCase()} · {slot.kind.toUpperCase()} · SIZE {slot.size}</p>
                  {inSlot(slot) ? (
                    <button type="button" className="eqb-btn eqb-btn-quiet" disabled={pending} data-testid={`button-unmount-${slot.id}`}
                      onClick={() => doFit(slot, null, "Module unmounted")}>{fit.isPending ? "WORKING…" : "UNMOUNT"}</button>
                  ) : null}
                </div>
                {locker.items.length === 0 ? <p className="eqb-state">Locker empty. Recover verified salvage below to obtain modules.</p> : (
                  <ul className="eqb-items">
                    {[...locker.items].sort((a, b) => reasons(a, slot).length - reasons(b, slot).length).map(item => {
                      const d = defs.get(item.equipmentId);
                      const why = reasons(item, slot);
                      const here = item.shipId === shipId && item.hardpointId === slot.id;
                      const elsewhere = item.shipId && !here;
                      return (
                        <li key={item.id} className={`eqb-item${why.length ? " is-blocked" : ""}${here ? " is-here" : ""}`} data-testid={`card-equipment-${item.id}`}>
                          <div className="eqb-item-head">
                            <div>
                              <b>{d?.name ?? item.equipmentId}</b>
                              <small>{d ? `${d.kind.toUpperCase()} · ${d.effect.toUpperCase()}` : "UNKNOWN"} · CONDITION {item.condition}/{d?.durability ?? "?"}</small>
                            </div>
                            {elsewhere ? (
                              <button type="button" className="eqb-btn eqb-btn-quiet" data-testid={`button-unequip-${item.id}`} disabled={pending}
                                onClick={() => doFit({ id: item.hardpointId! }, null, `${d?.name ?? "Module"} unequipped from ${item.shipId!.toUpperCase()}`, item.shipId!)}>
                                UNEQUIP
                              </button>
                            ) : (
                              <button type="button" className="eqb-btn" data-testid={`button-mount-${item.id}`}
                                disabled={pending || here || why.length > 0}
                                onClick={() => doFit(slot, item.id, `${d?.name ?? "Module"} mounted`)}>
                                {here ? "MOUNTED" : "MOUNT"}
                              </button>
                            )}
                          </div>
                          {why.length ? <ul className="eqb-why">{why.map(w => <li key={w}>{w}</li>)}</ul> : null}
                          {d ? <><p className="eqb-desc">{d.description}</p><Stats d={d} /></> : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <section className="eqb-salvage" aria-label="Verified salvage">
        <p className="eqb-kicker">VERIFIED SALVAGE · {locker.salvage.length}</p>
        <p className="eqb-note">Drawn from your newest 30 verified encounter ledger entries only.</p>
        {locker.salvage.length === 0 ? (
          <p className="eqb-state" data-testid="text-salvage-empty">No recoverable packages in your newest 30 verified encounter records. Older history is not listed here.</p>
        ) : (
          <ul>
            {locker.salvage.map(s => (
              <li key={`${s.eventId}:${s.actorId}`} data-testid={`row-salvage-${s.eventId}`}>
                <span><b>{defs.get(s.equipmentId)?.name ?? "Sealed package"}</b><small>EVENT {s.eventId.slice(0, 12)}</small></span>
                <button type="button" className="eqb-btn" disabled={pending} data-testid={`button-recover-${s.eventId}`}
                  onClick={() => doRecover(s.eventId, s.actorId)}>{recover.isPending ? "RECOVERING…" : "RECOVER"}</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function Budget({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const pct = Math.min(1, limit ? used / limit : 0);
  return (
    <div className={`eqb-budget${used > limit ? " is-over" : ""}`} data-testid={`text-budget-${label.toLowerCase()}`}>
      <span>{label} <b>{used}/{limit}{unit}</b></span>
      <i><em style={{ transform: `scaleX(${pct})` }} /></i>
    </div>
  );
}

function Stats({ d }: { d: EquipmentDefinition }) {
  return (
    <dl className="eqb-stats">
      {STATS.map(([k, label, unit]) => (
        <div key={k} className={d[k] === 0 ? "is-zero" : ""}><dt>{label}</dt><dd>{String(d[k])}{unit && d[k] !== 0 ? ` ${unit}` : ""}</dd></div>
      ))}
    </dl>
  );
}
