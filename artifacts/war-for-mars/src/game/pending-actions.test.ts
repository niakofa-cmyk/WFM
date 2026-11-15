import assert from "node:assert/strict";
import test from "node:test";
import { acknowledgePending, journalKey, readPending, savePending, type PendingAction } from "./pending-actions";
const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
};
const action: PendingAction = { version: 1, id: "stable-request", kind: "market", label: "Buy iron", data: { goodId: "iron", side: "buy", quantity: 1 }, createdAt: "2026-10-20T00:00:00Z" };
test("lost-response recovery retains the same request across reload and isolates accounts", () => {
  const storage = memory();
  savePending(storage, "pilot-a", action);
  assert.deepEqual(readPending(storage, "pilot-a"), action);
  assert.equal(readPending(storage, "pilot-b"), null);
  assert.throws(() => savePending(storage, "pilot-a", { ...action, id: "new-key" }), /pending action/);
  acknowledgePending(storage, "pilot-a", "unrelated-response");
  assert.equal(readPending(storage, "pilot-a")?.id, "stable-request");
  acknowledgePending(storage, "pilot-a", "stable-request");
  assert.equal(readPending(storage, "pilot-a"), null);
});
test("corrupt or unavailable recovery storage fails closed before a new action", () => {
  const storage = memory();
  storage.setItem(journalKey("pilot"), "bad json");
  assert.throws(() => savePending(storage, "pilot", action));
  assert.throws(() => savePending({ ...memory(), setItem: () => { throw new Error("quota exceeded"); } }, "pilot", action), /quota exceeded/);
});
