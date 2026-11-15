import assert from "node:assert/strict";
import test from "node:test";
import { privateRoomDockAccess } from "./private-room-dock";

test("private rooms are entered from the Cinder Ring dock, not from elsewhere in the universe", () => {
  assert.deepEqual(privateRoomDockAccess(false, "3766A7C24D"), {
    canCreate: false,
    canJoin: false,
  });
});

test("the Cinder Ring dock allows private room creation and validates invite codes", () => {
  assert.deepEqual(privateRoomDockAccess(true, ""), {
    canCreate: true,
    canJoin: false,
  });
  assert.deepEqual(privateRoomDockAccess(true, " 3766a7c24d "), {
    canCreate: true,
    canJoin: true,
  });
  assert.equal(privateRoomDockAccess(true, "short").canJoin, false);
  assert.equal(privateRoomDockAccess(true, "BAD_CODE!").canJoin, false);
});
