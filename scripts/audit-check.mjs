// Local proof for the combat sim, power presets, eight-ship roster,
// yard math, and save recovery. This does not cover a physical phone,
// frame time, heat, or a server-authoritative multiplayer match.
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};

const sim = await server.ssrLoadModule("/src/game/sim.ts");
const ships = await server.ssrLoadModule("/src/game/ships.ts");
const market = await server.ssrLoadModule("/src/game/market.ts");
const saveMod = await server.ssrLoadModule("/src/game/save.ts");

function idle(extra = {}) {
  return {
    throttle: 0,
    yaw: 0,
    strafe: 0,
    pitch: 0,
    fire: false,
    ult: false,
    lock: false,
    evade: 0,
    preset: null,
    ...extra,
  };
}

const failures = [];
function check(cond, message) {
  if (!cond) failures.push(message);
}

function quiet(match) {
  for (const craft of [...match.allies, ...match.enemies]) {
    craft.alive = false;
    craft.respawn = 99;
    craft.fireCd = 99;
  }
}

function park(match, foe) {
  foe.alive = true;
  foe.guard = 0;
  foe.untargetable = 0;
  foe.fireCd = 99;
  foe.x = 0;
  foe.z = match.player.z - 5;
  match.player.x = 0;
  match.player.yaw = 0;
  match.player.speed = 0;
  match.player.fireCd = 0;
  match.player.guard = 0;
}

const ids = Object.keys(ships.SHIPS);
check(ids.length === 8, `roster count ${ids.length}`);
check(ships.ROSTER.accord.length === 4 && ships.ROSTER.ussf.length === 4, "faction wings");
const overlap = ships.ROSTER.accord.filter((id) => ships.ROSTER.ussf.includes(id));
check(overlap.length === 0, "shared hulls");

const pools = ids.map((id) => ships.SHIPS[id].shield + ships.SHIPS[id].hull);
const lightest = Math.min(...pools);
for (const id of ids) {
  const def = ships.SHIPS[id];
  for (const key of ["shield", "hull", "fireInterval", "shotDmg", "maxSpeed", "accel", "turnRate", "radius", "ultCd"]) {
    check(Number.isFinite(def[key]) && def[key] > 0, `${id} ${key}`);
  }
  check(def.shotDmg < lightest, `${id} one-shots a full ship`);
  const faction = ships.ROSTER.accord.includes(id) ? "accord" : "ussf";
  const match = sim.createMatch(id, faction, 0, "practice");
  check(match.player.ship === id && match.runner == null, `${id} spawn`);
  quiet(match);
  const foe = match.enemies[0];
  park(match, foe);
  foe.shield = 0;
  foe.hull = 80;
  const before = foe.hull;
  sim.step(match, idle({ fire: true }), 1 / 60);
  for (let i = 0; i < 40 && foe.hull === before; i++) sim.step(match, idle(), 1 / 60);
  check(foe.hull < before, `${id} shot dealt nothing`);
  check(Number.isFinite(foe.hull) && foe.hull >= 0, `${id} hull ${foe.hull}`);
}

check(ships.SHIPS.mandjet.shield + ships.SHIPS.mandjet.hull > ships.SHIPS.shakuna.shield + ships.SHIPS.shakuna.hull, "mandjet heavier than shakuna");
check(ships.SHIPS.sentinel.shield + ships.SHIPS.sentinel.hull > ships.SHIPS.glide.shield + ships.SHIPS.glide.hull, "sentinel heavier than glide");
check(ships.SHIPS.shakuna.handling > ships.SHIPS.mandjet.handling, "hunter turns inside the juggernaut");

const guarded = sim.createMatch("sentinel", "ussf", 0, "practice");
quiet(guarded);
park(guarded, guarded.enemies[0]);
const ward = guarded.enemies[0];
ward.shield = ward.shieldMax;
ward.hull = 40;
ward.guard = 5;
sim.step(guarded, idle({ fire: true }), 1 / 60);
for (let i = 0; i < 20; i++) sim.step(guarded, idle(), 1 / 60);
check(ward.hull === 40 && ward.shield >= ward.shieldMax - 0.01, `guard let a hit through ${ward.shield}/${ward.hull}`);

const doomed = sim.createMatch("mandjet", "accord", 0, "practice");
quiet(doomed);
const killer = doomed.enemies[0];
killer.alive = true;
killer.respawn = 0;
killer.fireCd = 0;
killer.guard = 0;
killer.x = doomed.player.x;
killer.z = doomed.player.z + 3;
killer.yaw = Math.atan2(-(doomed.player.x - killer.x), -(doomed.player.z - killer.z));
doomed.player.shield = 0;
doomed.player.hull = 1;
doomed.player.guard = 0;
doomed.player.untargetable = 0;
for (let i = 0; i < 90 && doomed.player.alive; i++) sim.step(doomed, idle(), 1 / 60);
check(!doomed.player.alive, "player did not die");
check(doomed.deaths === 1, `deaths ${doomed.deaths}`);
const deadHull = doomed.player.hull;
check(deadHull === 0, "corpse kept hull");
for (let i = 0; i < 8; i++) sim.step(doomed, idle(), 0.5);
check(doomed.player.alive && doomed.player.hull === doomed.player.hullMax, "respawn did not restore the hull");

const grounded = sim.createMatch("mandjet", "accord", 0, "practice");
quiet(grounded);
grounded.youBar = 0;
grounded.player.alive = false;
grounded.player.respawn = 0.1;
sim.step(grounded, idle(), 0.2);
check(!grounded.player.alive, "respawned with a broken wing");

const ace = sim.createMatch("shakuna", "accord", 0, "strike", { goal: "ace" });
const warden = ace.enemies.find((enemy) => enemy.ace);
check(!!warden, "ace missing");
warden.alive = false;
warden.respawn = 0.05;
sim.step(ace, idle(), 0.2);
check(!warden.alive, "warden came back");

const disc = sim.createMatch("tripura", "accord", 0, "practice");
quiet(disc);
disc.foeBar = 0;
sim.step(disc, idle(), 0.05);
check(disc.over === "win", `disc win ${disc.over}`);
const frozen = disc.kills;
sim.step(disc, idle({ fire: true, yaw: 1 }), 1);
check(disc.over === "win" && disc.kills === frozen, "finished match kept simulating");

const clock = sim.createMatch("glide", "ussf", 0, "practice");
quiet(clock);
clock.time = 119.9;
clock.youBar = 40;
clock.foeBar = 40;
sim.step(clock, idle(), 0.2);
check(clock.over === "draw", `clock draw ${clock.over}`);

for (const preset of [1, 2, 3]) {
  const match = sim.createMatch("splitter", "ussf", 0, "practice");
  quiet(match);
  const [eng, wep, def] = ships.PRESET_PIPS[preset];
  sim.step(match, idle({ preset }), 1 / 60);
  check(match.preset === preset && match.ramp < 1 && match.presetCd > 3.9, `preset ${preset} did not start a ramp`);
  let low = Infinity;
  let high = -Infinity;
  for (let i = 0; i < 40; i++) {
    sim.step(match, idle(), 0.02);
    for (const pip of [match.pips.eng, match.pips.wep, match.pips.def]) {
      check(Number.isFinite(pip), `pip NaN on ${preset}`);
      low = Math.min(low, pip);
      high = Math.max(high, pip);
    }
  }
  check(low >= 0.99 && high <= 4.01, `pips left 1..4 on ${preset} (${low}..${high})`);
  check(Math.abs(match.pips.eng - eng) < 0.02, `eng ${match.pips.eng} != ${eng}`);
  check(Math.abs(match.pips.wep - wep) < 0.02, `wep ${match.pips.wep} != ${wep}`);
  check(Math.abs(match.pips.def - def) < 0.02, `def ${match.pips.def} != ${def}`);
  const held = match.preset;
  sim.step(match, idle({ preset: 0 }), 0.05);
  check(match.preset === held, "preset changed during cooldown");
}

const junk = sim.createMatch("glide", "ussf", 0, "practice");
quiet(junk);
sim.step(junk, idle({ preset: 7 }), 0.05);
check(junk.preset === 0 && junk.over == null, "bad preset was accepted");

const bal = sim.createMatch("duskbreaker", "ussf", 0, "practice");
const wep = sim.createMatch("duskbreaker", "ussf", 0, "practice");
quiet(bal);
quiet(wep);
for (const match of [bal, wep]) {
  park(match, match.enemies[0]);
  match.enemies[0].shield = 0;
  match.enemies[0].hull = 80;
}
sim.step(wep, idle({ preset: 1 }), 1 / 60);
for (let i = 0; i < 30; i++) sim.step(wep, idle(), 1 / 60);
for (let i = 0; i < 31; i++) sim.step(bal, idle(), 1 / 60);
sim.step(wep, idle({ fire: true }), 1 / 60);
sim.step(bal, idle({ fire: true }), 1 / 60);
for (let i = 0; i < 40; i++) {
  sim.step(wep, idle(), 1 / 60);
  sim.step(bal, idle(), 1 / 60);
}
check(wep.enemies[0].hull < bal.enemies[0].hull - 0.2, `WEP ${wep.enemies[0].hull} vs BAL ${bal.enemies[0].hull}`);

const eng = sim.createMatch("shakuna", "accord", 0, "practice");
const stock = sim.createMatch("shakuna", "accord", 0, "practice");
quiet(eng);
quiet(stock);
sim.step(eng, idle({ preset: 3, throttle: 1 }), 0.6);
sim.step(stock, idle({ throttle: 1 }), 0.6);
check(eng.player.speed > stock.player.speed + 0.4, `ENG speed ${eng.player.speed} vs ${stock.player.speed}`);

const def = sim.createMatch("sentinel", "ussf", 0, "practice");
quiet(def);
const baseMax = def.player.shieldMax;
sim.step(def, idle({ preset: 2 }), 0.5);
check(def.player.shieldMax > baseMax, `DEF shield ${def.player.shieldMax} vs ${baseMax}`);

const prices = market.basePrices();
check(market.winBid(100) === 135, "win bid");
check(market.dockValue(100) === 70, "dock");
check(market.scrapValue(100) === 40, "scrap");
check(market.winBid(80) > market.dockValue(80) && market.dockValue(80) > market.scrapValue(80), "payout order");
let drifting = { ...prices };
for (let i = 0; i < 80; i++) drifting = market.drift(drifting, i % 2 === 0 ? "iron" : null);
for (const good of market.GOODS) {
  const lo = Math.round(good.base * 0.55);
  const hi = Math.round(good.base * 1.9);
  check(drifting[good.id] >= lo && drifting[good.id] <= hi, `${good.id} drifted to ${drifting[good.id]}`);
}

const pocket = { credits: 50, hold: null, paid: 0, prices: { ...prices, salt: 40 } };
const bought = market.applyBuy(pocket, "salt");
check(bought.credits === 10 && bought.hold === "salt" && bought.paid === 40, "buy salt");
check(market.applyBuy(bought, "iron") === bought, "second crate");
const broke = market.applyBuy({ ...pocket, credits: 10 }, "salt");
check(broke.hold == null && broke.credits === 10, "bought without credits");
const docked = market.applyDock(bought);
check(docked.hold == null && docked.paid === 0 && docked.credits === 10 + 28, `dock pay ${docked.credits}`);
check(market.applyDock(docked) === docked, "docked an empty hold");

const yard = saveMod.defaultSave();
check(saveMod.applyRefit({ ...yard, credits: 10 }).refit === 0, "refit on credit");
const fitted = saveMod.applyRefit({ ...yard, credits: 200 });
check(fitted.refit === 1 && fitted.credits === 80, `refit ledger ${fitted.credits}`);
check(saveMod.applyRefit({ ...yard, refit: 5, credits: 9999 }).refit === 5, "refit past max");

memory.clear();
check(saveMod.loadSave().ship === "mandjet" && saveMod.loadSave().credits === 90, "empty save");
saveMod.writeSave({ ...yard, credits: 240, ship: "glide", faction: "ussf", mission: "cage", cleared: 3, tech: "mark" });
const round = saveMod.loadSave();
check(round.credits === 240 && round.ship === "glide" && round.mission === "cage" && round.tech === "mark", "round trip");

memory.set("wfm-save-v1", "{");
check(saveMod.loadSave().ship === "mandjet", "broken json");
memory.set("wfm-save-v1", JSON.stringify({ v: 2, ship: "glide", faction: "ussf", credits: 500 }));
check(saveMod.loadSave().credits === 90, "wrong version kept");
memory.set("wfm-save-v1", JSON.stringify({ v: 1, ship: "nope", faction: "ussf", credits: 500 }));
check(saveMod.loadSave().credits === 90, "unknown ship kept");
memory.set(
  "wfm-save-v1",
  JSON.stringify({
    v: 1,
    ship: "sundara",
    faction: "accord",
    credits: -40,
    refit: 99,
    hold: "gold",
    paid: 10,
    mission: "forge",
    cleared: 0,
    tech: "mark",
    pace: "blitz",
  }),
);
const messy = saveMod.loadSave();
check(messy.ship === "sundara", "partial save dropped the ship");
check(messy.credits === 0, `negative credits ${messy.credits}`);
check(messy.refit === 5, `refit clamp ${messy.refit}`);
check(messy.hold == null && messy.paid === 0, "fake cargo");
check(messy.mission === "contact" && messy.tech == null && messy.pace === "practice", "bad mission, tech, or pace survived");

const confirm = sim.createMatch("sundara", "accord", 0, "practice");
quiet(confirm);
const bandit = confirm.enemies[0];
park(confirm, bandit);
bandit.shield = 0;
bandit.hull = 1;
const banditName = ships.SHIPS[bandit.ship].name;
sim.step(confirm, idle({ fire: true }), 1 / 60);
for (let i = 0; i < 50 && bandit.alive; i++) sim.step(confirm, idle(), 1 / 60);
check(!bandit.alive, "callout target lived");
check(confirm.fx.some((ev) => ev.k === "ping"), "hit left no mark");
check(
  confirm.fx.some((ev) => ev.k === "down" && ev.name === banditName),
  `no down call for ${banditName}`,
);

const stung = sim.createMatch("mandjet", "accord", 0, "practice");
quiet(stung);
const gun = stung.enemies[0];
gun.alive = true;
gun.respawn = 0;
gun.fireCd = 0;
gun.guard = 0;
gun.x = stung.player.x;
gun.z = stung.player.z + 6;
gun.yaw = 0;
stung.player.yaw = 0;
stung.player.guard = 0;
stung.player.shield = 80;
stung.player.hull = 80;
let rear = null;
for (let i = 0; i < 40 && !rear; i++) {
  sim.step(stung, idle(), 1 / 60);
  rear = stung.fx.find((ev) => ev.k === "hit" && ev.you);
}
check(!!rear, "no incoming hit");
if (rear) check(rear.fromZ > stung.player.z, `hit bearing ${rear.fromZ} vs ${stung.player.z}`);
stung.player.alive = false;
stung.player.respawn = 3.4;
sim.step(stung, idle(), 1);
check(!stung.player.alive && stung.player.respawn < 2.6 && stung.player.respawn > 2, `hull timer ${stung.player.respawn}`);

await server.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("audit checks ok");
