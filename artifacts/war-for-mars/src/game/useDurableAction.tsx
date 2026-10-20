import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  tradeMarket, travelWorld, exploreLocation, actOnWorldQuest, executeWorldService, applyProgressionAction,
  getGetWorldQueryKey, getGetMarketQueryKey,
  type MarketTradeInput, type WorldTravelInput, type WorldQuestActionInput, type WorldServiceInput,
} from "@workspace/api-client-react";
import { acknowledgePending, readPending, savePending, type PendingAction, type PendingKind } from "./pending-actions";

type Request =
  | { kind: "market"; data: Omit<MarketTradeInput, "idempotencyKey"> }
  | { kind: "travel"; data: Omit<WorldTravelInput, "idempotencyKey"> }
  | { kind: "explore"; data: { locationId: string } }
  | { kind: "quest"; data: Omit<WorldQuestActionInput, "idempotencyKey"> & { questId: string } }
  | { kind: "service"; data: Omit<WorldServiceInput, "idempotencyKey"> }
  | { kind: "refit"; data: { action: "refit" } };
const CHANGE = "wfm:pending-changed";
const flights = new Map<string, Promise<unknown>>();
let visibleAccount = "";
function storage() {
  try { return window.localStorage; } catch { throw new Error("Recovery storage is unavailable. Enable local storage before changing your ledger."); }
}
async function dispatch(action: PendingAction, signal: AbortSignal) {
  const data = { ...action.data, idempotencyKey: action.id };
  switch (action.kind) {
    case "market": return tradeMarket(data as MarketTradeInput, { signal });
    case "travel": return travelWorld(data as WorldTravelInput, { signal });
    case "explore": return exploreLocation(String(action.data.locationId), { idempotencyKey: action.id }, { signal });
    case "quest": return actOnWorldQuest(String(action.data.questId), { idempotencyKey: action.id, action: action.data.action as "accept" | "claim" }, { signal });
    case "service": return executeWorldService(data as WorldServiceInput, { signal });
    case "refit": return applyProgressionAction({ idempotencyKey: action.id, action: "refit" }, { signal });
  }
}
const message = (error: unknown) => error instanceof Error ? error.message : "The outcome is unknown. Retry the retained request.";
export function useDurableAction() {
  const { user } = useUser();
  const userId = user?.id ?? "";
  const client = useQueryClient();
  const [, update] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const changed = () => update((v) => v + 1);
    window.addEventListener(CHANGE, changed);
    window.addEventListener("storage", changed);
    return () => { window.removeEventListener(CHANGE, changed); window.removeEventListener("storage", changed); };
  }, []);
  let pending: PendingAction | null = null;
  let journalError = "";
  try { if (userId) pending = readPending(storage(), userId); } catch (cause) { journalError = message(cause); }
  const notify = () => window.dispatchEvent(new Event(CHANGE));
  const execute = useCallback(async (action: PendingAction) => {
    if (!userId) throw new Error("Sign in to recover this action.");
    const existing = flights.get(userId);
    if (existing) return existing;
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    const promise = (async () => {
      try {
        const result = await dispatch(action, controller.signal);
        // Only the current account's journal can be acknowledged.
        acknowledgePending(storage(), userId, action.id);
        if (visibleAccount === userId) {
          if ("world" in result) client.setQueryData(getGetWorldQueryKey(), result.world);
          if ("market" in result) client.setQueryData(getGetMarketQueryKey(), result.market);
          // A confirmed write must not stay locked behind a stalled background read.
          void client.invalidateQueries().catch(() => undefined);
          window.dispatchEvent(new Event("wfm:profile-refresh"));
        }
        return result;
      } catch (cause) {
        const status = Number((cause as { status?: number })?.status);
        // Server rejection is definitive. Network/5xx/expired-session outcomes remain pending.
        if ([400, 403, 404, 409, 422].includes(status)) {
          acknowledgePending(storage(), userId, action.id);
          if (visibleAccount === userId) void client.invalidateQueries().catch(() => undefined);
        }
        setError(message(cause));
        throw cause;
      } finally { window.clearTimeout(timeout); flights.delete(userId); notify(); }
    })();
    flights.set(userId, promise);
    notify();
    return promise;
  }, [client, userId]);
  const run = async (request: Request, label: string) => {
    if (!userId) throw new Error("Sign in before submitting an action.");
    const action: PendingAction = { version: 1, id: crypto.randomUUID(), kind: request.kind as PendingKind, data: request.data, label, createdAt: new Date().toISOString() };
    savePending(storage(), userId, action); // persist BEFORE dispatch, never trust local rewards
    notify();
    return execute(action);
  };
  const retry = useCallback(async () => {
    const action = readPending(storage(), userId);
    if (action) return execute(action);
    return undefined;
  }, [execute, userId]);
  return { pending, busy: flights.has(userId), error: journalError || error, blocked: Boolean(pending || journalError || flights.has(userId)), run, retry, dismiss: () => setError("") };
}

export function ActionRecovery() {
  const { user } = useUser();
  const { pending, busy, error, retry, dismiss } = useDurableAction();
  useEffect(() => {
    const id = user?.id ?? "";
    visibleAccount = id;
    return () => { if (visibleAccount === id) visibleAccount = ""; };
  }, [user?.id]);
  useEffect(() => {
    const recover = () => { if (navigator.onLine) void retry().catch(() => undefined); };
    window.addEventListener("online", recover);
    const interval = window.setInterval(recover, 30000);
    recover();
    return () => { window.removeEventListener("online", recover); window.clearInterval(interval); };
  }, [retry]);
  if (!pending && !error) return null;
  return <aside role="status" data-testid="action-recovery" className="fixed bottom-3 left-3 right-3 z-[110] mx-auto max-w-xl border border-solar/50 bg-panel p-4 text-bone shadow-xl">
    <p className="font-hud tracking-widest text-solar">{busy ? "VERIFYING SERVER OUTCOME" : pending ? "ACTION AWAITING CONFIRMATION" : "ACTION NOT COMPLETED"}</p>
    <p className="mt-1 text-sm">{pending?.label} {error || "Progress is not awarded until the server confirms it."}</p>
    {pending && <button type="button" data-testid="button-recover-action" disabled={busy} onClick={() => void retry().catch(() => undefined)} className="mt-2 border border-bone/30 px-4 py-2 disabled:opacity-40">RETRY SAME REQUEST</button>}
    {!pending && error && <button type="button" onClick={dismiss} className="mt-2 border border-bone/30 px-4 py-2">DISMISS</button>}
  </aside>;
}

export function useOfflineSnapshot<T>(name: string, fresh: T | undefined, stale = false) {
  const { user } = useUser();
  const key = user ? `wfm:read-only:v1:${user.id}:${name}` : "";
  const cached = useMemo(() => {
    try { return key ? JSON.parse(localStorage.getItem(key) || "null") as T | null : null; } catch { return null; }
  }, [key]);
  useEffect(() => {
    if (key && fresh !== undefined && !stale) { try { localStorage.setItem(key, JSON.stringify(fresh)); } catch { /* cache is optional; journal is not */ } }
  }, [key, fresh, stale]);
  return { data: fresh ?? cached ?? undefined, cached: stale || (fresh === undefined && cached !== null) };
}
