import assert from "node:assert/strict";
import test from "node:test";
import { accountBootMenu, enterOrbitalOnAccountBoot, resolveWfmBoot } from "./wfm-boot";

test("Orbital is primary, with explicit presentation-only rollback", () => {
  assert.equal(resolveWfmBoot(""), "orbital");
  assert.equal(resolveWfmBoot("?boot=compatibility"), "compatibility");
  assert.equal(resolveWfmBoot("", false), "compatibility");
  assert.equal(resolveWfmBoot("?runtime=surface-v1&rewards=true"), "orbital");
});
test("account boot requires explicit hangar launch and preserves other entry paths", () => {
  assert.equal(accountBootMenu(true, false, ""), "MAIN_MENU");
  assert.equal(accountBootMenu(true, false, "?room=INVITE"), "TITLE");
  assert.equal(accountBootMenu(true, true, ""), "TITLE");
  assert.equal(accountBootMenu(false, false, ""), "TITLE");
  assert.equal(enterOrbitalOnAccountBoot(true, false, ""), false);
  assert.equal(enterOrbitalOnAccountBoot(true, false, "?launch=true&rewards=true"), false);
  assert.equal(enterOrbitalOnAccountBoot(true, false, "?room=INVITE"), false);
  assert.equal(enterOrbitalOnAccountBoot(true, true, ""), false);
  assert.equal(enterOrbitalOnAccountBoot(false, false, ""), false);
});
