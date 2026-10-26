import assert from "node:assert/strict";
import { test } from "node:test";
import { acknowledgeInterruptedNotice } from "./interrupted-ack";

test("restart notice acknowledgement is sent on the open socket without closing it", () => {
  const sent: string[] = [];
  let closed = false;
  const result = acknowledgeInterruptedNotice({
    readyState: 1,
    send: (data) => sent.push(data),
    close: () => { closed = true; },
  });

  assert.equal(result, true);
  assert.deepEqual(sent.map((data) => JSON.parse(data)), [
    { type: "interrupted_ack" },
  ]);
  assert.equal(closed, false);
});

test("restart acknowledgement is not sent on a non-open socket", () => {
  let sendCalls = 0;
  let closeCalls = 0;
  const result = acknowledgeInterruptedNotice({
    readyState: 3,
    send: () => { sendCalls += 1; },
    close: () => { closeCalls += 1; },
  });

  assert.equal(result, false);
  assert.equal(sendCalls, 0);
  assert.equal(closeCalls, 0);
});

test("a failed restart acknowledgement closes the unusable socket", () => {
  let closeCalls = 0;
  const result = acknowledgeInterruptedNotice({
    readyState: 1,
    send: () => { throw new Error("send failed"); },
    close: () => { closeCalls += 1; },
  });

  assert.equal(result, false);
  assert.equal(closeCalls, 1);
});
