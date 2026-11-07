import assert from "node:assert/strict";
import test from "node:test";
import { enterOrbitalOnAccountBoot, resolveWfmBoot } from "./wfm-boot";

test("Orbital is primary, with explicit presentation-only rollback", () => {
  assert.equal(resolveWfmBoot(""), "orbital");
  assert.equal(resolveWfmBoot("?boot=compatibility"), "compatibility");
  assert.equal(resolveWfmBoot("", false), "compatibility");
  assert.equal(resolveWfmBoot("?runtime=surface-v1&rewards=true"), "orbital");
});
test("account boot preserves invite and account chart authority paths", () => {
  assert.equal(enterOrbitalOnAccountBoot(true, false, ""), true);
  assert.equal(enterOrbitalOnAccountBoot(true, false, "?room=INVITE"), false);
  assert.equal(enterOrbitalOnAccountBoot(true, true, ""), false);
  assert.equal(enterOrbitalOnAccountBoot(false, false, ""), false);
});
