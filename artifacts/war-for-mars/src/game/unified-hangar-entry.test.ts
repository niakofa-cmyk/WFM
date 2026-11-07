import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("./HomeScreen.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("hangar exposes one prominent connected-universe gateway", () => {
  assert.equal((home.match(/data-testid="button-enter-universe"/g) ?? []).length, 1);
  assert.match(home, /onClick=\{onEnterUniverse\} data-testid="button-enter-universe"/);
  assert.match(home, /THE GAME RUNS INSIDE ORBITAL/);
  assert.doesNotMatch(home, /data-testid="button-open-galaxy"|PERSISTENT GALAXY/);
});

test("hangar gateway mounts Orbital flight directly; local practice remains a separate secondary option", () => {
  const app = readFileSync(new URL("./WarApp.tsx", import.meta.url), "utf8");
  assert.match(app, /onEnterUniverse=\{\(\) => \{ unlockAudio\(\); void enterOrbitalUniverse\(\); \}\}/);
  assert.match(app, /const enterOrbitalUniverse = async \(\) =>/);
  assert.match(app, /setOrbitalUniverseOpen\(true\)/);
  assert.match(app, /onLocalUniverse=\{\(\) => \{[\s\S]*?setOrbitalStartLocation\("mars-orbit"\)/);
  assert.match(app, /if \(orbitalUniverseOpen && phase === "brief" && !galaxyOpen && !onlineSession\)/);
  assert.match(app, /modeId=\{UNIVERSE_MODE_ID\}[\s\S]*?runtime=\{ORBITAL_RUNTIME_ID\}/);
  assert.doesNotMatch(app, /onEnterUniverse=\{\(\) => setGalaxyOpen\(true\)\}/);
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

test("command destinations remain available on home, fleet, and settings screens", () => {
  assert.match(home, /state === "MAIN_MENU" \|\| state === "ARMORY" \|\| state === "SETTINGS"/);
  assert.match(home, /<CommandBottomNavigation state=\{state\}/);
  for (const destination of ["home", "profile", "fleet", "operations", "multiplayer", "settings"]) {
    assert.match(home, new RegExp(`data-testid="nav-command-${destination}"`));
  }
  assert.doesNotMatch(home, /data-testid="nav-command-universe"/);
});

test("settings tabs expose only working controls, audio, and account functions", () => {
  for (const tab of ["controls", "audio", "account"]) {
    assert.match(home, new RegExp(`tab-settings-${tab}`));
    assert.match(home, new RegExp(`settings-panel-${tab}`));
  }
  assert.match(home, /onClick=\{props\.onAudioMute\}/);
  assert.match(home, /props\.onScheme\("arc"\)/);
  assert.match(home, /props\.onGyro/);
  assert.doesNotMatch(home, /DISPLAY BRIGHTNESS SLIDER|HUD SCALE SLIDER|MUSIC VOLUME SLIDER/);
});

test("fleet and loadout navigation open distinct armory tabs", () => {
  assert.match(home, /data-testid="button-hangar-fleet"/);
  assert.match(home, /data-testid="button-hangar-loadout"/);
  assert.match(home, /data-testid="tab-armory-fleet"/);
  assert.match(home, /data-testid="tab-armory-loadout"/);
  assert.match(home, /onOpenArmory\("loadout"\)/);
  assert.match(home, /data-testid="panel-armory-loadout"/);
});
