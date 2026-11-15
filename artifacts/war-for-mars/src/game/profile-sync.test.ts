import assert from "node:assert/strict";
import { test } from "node:test";
import { createProfileSync } from "./profile-sync";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

test("profile refresh coalesces bursts and never applies superseded data", async () => {
  const first = deferred<number>();
  const second = deferred<number>();
  let calls = 0;
  const applied: number[] = [];
  const sync = createProfileSync(() => (++calls === 1 ? first.promise : second.promise), (p) => applied.push(p), () => assert.fail("unexpected error"));
  const pending = sync.refresh();
  await sync.refresh();
  await sync.refresh();
  first.resolve(90);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
  assert.deepEqual(applied, []);
  second.resolve(130);
  await pending;
  assert.deepEqual(applied, [130]);
});

test("disposed account/view cannot apply a response or start another request", async () => {
  const request = deferred<number>();
  let calls = 0;
  const sync = createProfileSync(() => { calls++; return request.promise; }, () => assert.fail("disposed result applied"), () => assert.fail("disposed error applied"));
  const pending = sync.refresh();
  sync.dispose();
  request.resolve(130);
  await pending;
  await sync.refresh();
  assert.equal(calls, 1);
});

test("failed refresh reports failure and can recover on the next request", async () => {
  let calls = 0;
  let errors = 0;
  const applied: number[] = [];
  const sync = createProfileSync(async () => {
    if (++calls === 1) throw new Error("offline");
    return 130;
  }, (p) => applied.push(p), () => { errors++; });
  await sync.refresh();
  await sync.refresh();
  assert.equal(errors, 1);
  assert.deepEqual(applied, [130]);
});
