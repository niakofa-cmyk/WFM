export type PendingKind = "market" | "travel" | "explore" | "quest" | "service" | "refit";
export type PendingAction = {
  version: 1;
  id: string;
  kind: PendingKind;
  label: string;
  data: Record<string, unknown>;
  createdAt: string;
};
export interface JournalStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export const journalKey = (userId: string) => `wfm:pending-action:v1:${userId}`;
export function readPending(storage: JournalStorage, userId: string): PendingAction | null {
  const raw = storage.getItem(journalKey(userId));
  if (!raw) return null;
  const value = JSON.parse(raw) as PendingAction;
  if (value.version !== 1 || !value.id || !value.data || !["market", "travel", "explore", "quest", "service", "refit"].includes(value.kind)) {
    throw new Error("Pending action journal is unreadable. Do not submit another order until recovered.");
  }
  return value;
}
export function savePending(storage: JournalStorage, userId: string, action: PendingAction) {
  if (readPending(storage, userId)) throw new Error("Resolve the pending action before starting another.");
  storage.setItem(journalKey(userId), JSON.stringify(action));
  if (readPending(storage, userId)?.id !== action.id) throw new Error("The recovery journal could not be saved.");
}
export function acknowledgePending(storage: JournalStorage, userId: string, id: string) {
  if (readPending(storage, userId)?.id === id) storage.removeItem(journalKey(userId));
}
