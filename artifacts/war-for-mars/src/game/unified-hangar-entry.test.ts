import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("./HomeScreen.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("hangar exposes one prominent connected-universe gateway", () => {
  assert.equal((home.match(/data-testid="button-enter-universe"/g) ?? []).length, 1);
  assert.match(home, /onClick=\{onGalaxy\} data-testid="button-enter-universe"/);
  assert.doesNotMatch(home, /data-testid="button-open-galaxy"|PERSISTENT GALAXY/);
});

test("local Orbital flight is secondary no-reward practice, not the main gateway", () => {
  const training = home.indexOf('data-testid="details-flight-systems"');
  const localFlight = home.indexOf('data-testid="button-home-local-universe"');
  const gateway = home.indexOf('data-testid="button-enter-universe"');
  assert.ok(training >= 0 && localFlight > training && gateway < localFlight);
  assert.match(home, /LOCAL FLIGHT TEST · ORBITAL/);
  assert.match(home, /Offline practice only · no account rewards/);
});

test("hangar command layout requires landscape and presents faction choice", () => {
  assert.match(home, /wfm-hangar-command-rail/);
  assert.match(home, /data-testid="button-select-faction-ussf"/);
  assert.match(home, /data-testid="button-select-faction-accord"/);
  assert.match(home, /data-testid="landscape-required"/);
  assert.match(home, /INFINITE WAR/);
  assert.match(home, /BUILD & COMMAND/);
  assert.ok(styles.includes(".wfm-unified-hangar__hero .wfm-hangar-scene"));
  assert.match(styles, /@media \(orientation: landscape\) and \(max-height: 560px\)/);
  assert.match(styles, /@media \(orientation: portrait\)/);
});
