import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

const sim = await server.ssrLoadModule("/src/game/sim.ts");

function idle() {
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
  };
}

function fail(message) {
  throw new Error(message);
}

const practice = sim.createMatch("mandjet", "accord", 0, "practice");
if (practice.limit !== 120) fail(`practice clock ${practice.limit}`);
if (practice.allies.length !== 4 || practice.enemies.length !== 5) fail("wing size");
if (practice.player.yaw !== 0) fail("spawn yaw");

const y0 = practice.player.yaw;
sim.step(practice, { ...idle(), yaw: 1, throttle: 1 }, 0.2);
if (practice.player.yaw <= y0) fail("positive steer did not increase yaw");
if (practice.player.speed <= 0.1) fail(`throttle ${practice.player.speed}`);

const strike = sim.createMatch("splitter", "ussf", 0, "strike");
if (strike.limit !== 360) fail(`strike clock ${strike.limit}`);
strike.time = 130;
sim.step(strike, idle(), 0.05);
if (strike.over) fail("strike ended before six minutes");

const paced = ["strike", "practice"].map((pace) => {
  const match = sim.createMatch("mandjet", "accord", 0, pace);
  match.relays[0].own = 1;
  match.relays[0].cap = 1;
  match.relays[1].own = 1;
  match.relays[1].cap = 1;
  match.player.alive = false;
  match.player.respawn = 99;
  for (const craft of [...match.allies, ...match.enemies]) {
    craft.alive = false;
    craft.respawn = 99;
  }
  sim.step(match, idle(), 1);
  return 100 - match.foeBar;
});
if (!(paced[0] > 0.6 && paced[0] < 1.1)) fail(`strike drain ${paced[0]}`);
if (!(paced[1] > 3 && paced[1] < 3.8)) fail(`practice drain ${paced[1]}`);

const shot = sim.createMatch("duskbreaker", "ussf", 0, "practice");
shot.player.guard = 0;
shot.player.fireCd = 0;
shot.player.yaw = 0;
shot.player.speed = 0;
for (const craft of [...shot.allies, ...shot.enemies]) {
  craft.alive = false;
  craft.fireCd = 99;
  craft.respawn = 99;
}
const foe = shot.enemies[0];
foe.alive = true;
foe.guard = 0;
foe.fireCd = 99;
foe.x = 0;
foe.z = shot.player.z - 5;
const before = foe.shield + foe.hull;
sim.step(shot, { ...idle(), fire: true }, 1 / 60);
for (let i = 0; i < 50; i++) sim.step(shot, idle(), 1 / 60);
const after = foe.shield + foe.hull;
if (!(after < before)) fail(`shot missed ${before} -> ${after}`);

const clock = sim.createMatch("mandjet", "accord", 0, "practice");
clock.time = 119.95;
clock.youBar = 30;
clock.foeBar = 80;
clock.player.alive = false;
clock.player.respawn = 99;
for (const craft of [...clock.allies, ...clock.enemies]) {
  craft.alive = false;
  craft.respawn = 99;
}
sim.step(clock, idle(), 0.1);
if (clock.over !== "loss") fail(`clock result ${clock.over}`);

const beacons = sim.createMatch("mandjet", "accord", 0, "practice", { goal: "beacons", allyCount: 2, foeCount: 3 });
if (beacons.allies.length !== 2 || beacons.enemies.length !== 3) fail("beacon wing");
beacons.relays[0].own = 1;
beacons.relays[0].cap = 1;
beacons.relays[1].own = 1;
beacons.relays[1].cap = 1;
beacons.player.alive = false;
beacons.player.respawn = 99;
for (const craft of [...beacons.allies, ...beacons.enemies]) {
  craft.alive = false;
  craft.respawn = 99;
}
sim.step(beacons, idle(), 0.05);
if (beacons.over !== "win") fail(`beacons ${beacons.over}`);

const warden = sim.createMatch("duskbreaker", "ussf", 0, "strike", { goal: "ace", foeCount: 5 });
const ace = warden.enemies.find((enemy) => enemy.ace);
if (!ace) fail("no warden");
ace.guard = 0;
ace.shield = 0;
ace.hull = 1;
ace.fireCd = 99;
ace.x = 0;
ace.z = warden.player.z - 5;
warden.player.yaw = 0;
warden.player.speed = 0;
warden.player.fireCd = 0;
for (const craft of [...warden.allies, ...warden.enemies]) {
  if (craft === ace) continue;
  craft.alive = false;
  craft.respawn = 99;
  craft.fireCd = 99;
}
sim.step(warden, { ...idle(), fire: true }, 1 / 60);
for (let i = 0; i < 50 && !warden.over; i++) sim.step(warden, idle(), 1 / 60);
if (warden.over !== "win") fail(`warden lived hull ${ace.hull} alive ${ace.alive}`);

warden.time = 359.9;
if (warden.over === "win") {
  const late = sim.createMatch("duskbreaker", "ussf", 0, "strike", { goal: "ace" });
  late.time = 359.95;
  late.player.alive = false;
  late.player.respawn = 99;
  for (const craft of [...late.allies, ...late.enemies]) {
    craft.alive = false;
    craft.respawn = 99;
  }
  const marked = late.enemies.find((enemy) => enemy.ace);
  marked.alive = true;
  marked.respawn = 99;
  sim.step(late, idle(), 0.1);
  if (late.over !== "loss") fail(`ace clock ${late.over}`);
}

const plain = sim.createMatch("mandjet", "accord", 0, "practice");
const quick = sim.createMatch("mandjet", "accord", 0, "practice", { tech: "barrels" });
plain.player.fireCd = 0;
quick.player.fireCd = 0;
for (const craft of [...plain.enemies, ...plain.allies, ...quick.enemies, ...quick.allies]) {
  craft.alive = false;
  craft.respawn = 99;
}
sim.step(plain, { ...idle(), fire: true }, 1 / 60);
sim.step(quick, { ...idle(), fire: true }, 1 / 60);
if (!(quick.player.fireCd < plain.player.fireCd - 0.01)) fail(`barrels ${quick.player.fireCd} vs ${plain.player.fireCd}`);

const loose = sim.createMatch("shakuna", "accord", 0, "practice", { tech: "stick" });
const stiff = sim.createMatch("shakuna", "accord", 0, "practice");
loose.player.speed = 8;
stiff.player.speed = 8;
sim.step(loose, { ...idle(), yaw: 1 }, 0.4);
sim.step(stiff, { ...idle(), yaw: 1 }, 0.4);
if (loose.player.yaw <= stiff.player.yaw) fail(`stick ${loose.player.yaw} vs ${stiff.player.yaw}`);

const marked = sim.createMatch("duskbreaker", "ussf", 0, "practice", { tech: "mark" });
const bare = sim.createMatch("duskbreaker", "ussf", 0, "practice");
for (const match of [marked, bare]) {
  const foe = match.enemies[0];
  for (const craft of [...match.allies, ...match.enemies]) {
    if (craft !== foe) {
      craft.alive = false;
      craft.respawn = 99;
    }
  }
  foe.x = 0;
  foe.z = match.player.z - 5;
  foe.shield = 80;
  foe.hull = 80;
  foe.guard = 0;
  foe.fireCd = 99;
  match.lockId = foe.id;
  match.player.yaw = 0;
  match.player.fireCd = 0;
  match.player.speed = 0;
}
sim.step(marked, { ...idle(), fire: true }, 1 / 60);
sim.step(bare, { ...idle(), fire: true }, 1 / 60);
for (let i = 0; i < 40; i++) {
  sim.step(marked, idle(), 1 / 60);
  sim.step(bare, idle(), 1 / 60);
}
const markedLeft = marked.enemies[0].shield + marked.enemies[0].hull;
const bareLeft = bare.enemies[0].shield + bare.enemies[0].hull;
if (!(markedLeft < bareLeft - 0.5)) fail(`mark ${markedLeft} vs ${bareLeft}`);

const escort = sim.createMatch("glide", "ussf", 0, "practice", { goal: "extract", disc: "dust", allyCount: 2, foeCount: 3 });
if (!escort.runner || escort.runner.team !== "you" || escort.disc !== "dust") fail("escort setup");
const z0 = escort.runner.z;
for (const craft of [...escort.allies, ...escort.enemies]) {
  craft.alive = false;
  craft.respawn = 99;
}
sim.step(escort, idle(), 1);
if (escort.runner.z >= z0 - 1) fail(`runner stuck ${escort.runner.z}`);
escort.runner.z = -69;
sim.step(escort, idle(), 0.05);
if (escort.over !== "win") fail(`escort exit ${escort.over}`);

const stop = sim.createMatch("mandjet", "accord", 0, "practice", { goal: "extract", allyCount: 1, foeCount: 1 });
if (stop.runner.team !== "foe") fail("intercept team");
stop.runner.hull = 4;
stop.runner.x = 0;
stop.runner.z = stop.player.z - 4;
stop.player.yaw = 0;
stop.player.fireCd = 0;
stop.player.speed = 0;
for (const craft of [...stop.allies, ...stop.enemies]) {
  craft.alive = false;
  craft.respawn = 99;
  craft.fireCd = 99;
}
sim.step(stop, { ...idle(), fire: true }, 1 / 60);
for (let i = 0; i < 90 && stop.over !== "win"; i++) sim.step(stop, idle(), 1 / 60);
if (stop.over !== "win") fail(`cage lived hull ${stop.runner.hull} alive ${stop.runner.alive}`);

await server.close();
console.log("sim checks ok");
