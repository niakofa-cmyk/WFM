import assert from "node:assert/strict";
import { test } from "node:test";
import { createPilotSessionStorage } from "./pilot-session-storage";

function fixture() {
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
  };
  return { storage, forPilot: (id: string | null) => createPilotSessionStorage(id, () => storage) };
}

test("pending claims and reconnect credentials remain isolated across pilot switches and reloads", () => {
  const { forPilot } = fixture();
  const first = forPilot("pilot-a");
  const second = forPilot("pilot-b");
  for (const key of ["wfm-pending-claim-v1", "wfm-room-private-room"]) {
    first.setItem(key, "first-pilot-data");
    assert.equal(second.getItem(key), null);
    second.setItem(key, "second-pilot-data");
    assert.equal(forPilot("pilot-a").getItem(key), "first-pilot-data");
    // A late completion from the old instance cannot erase the new pilot's data.
    first.removeItem(key);
    assert.equal(second.getItem(key), "second-pilot-data");
  }
});

test("ownerless legacy data is never restored into a signed-in pilot", () => {
  const { storage, forPilot } = fixture();
  for (const key of ["wfm-pending-claim-v1", "wfm-room-private-room"]) {
    storage.setItem(key, "unknown-owner");
    assert.equal(forPilot("pilot-a").getItem(key), null);
    assert.equal(forPilot("pilot-b").getItem(key), null);
  }
});

test("game storage rejects reads and writes without a pilot identity", () => {
  const { forPilot } = fixture();
  const storage = forPilot(null);
  assert.throws(() => storage.getItem("claim"), /signed-in pilot/);
  assert.throws(() => storage.setItem("claim", "data"), /signed-in pilot/);
  assert.throws(() => storage.removeItem("claim"), /signed-in pilot/);
});
