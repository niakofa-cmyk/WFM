import { otherFaction, PRESET_PIPS, refitMul, ROSTER, SHIPS, type Faction, type PresetId, type ShipId } from "./ships";

export const ARENA_R = 78;
export const MATCH_SECONDS = 120;

export type Pace = "practice" | "strike";
export type Goal = "disc" | "beacons" | "ace" | "extract";
export type Disc = "rust" | "beacon" | "night" | "dust";

export type Craft = {
  id: number; ship: ShipId; faction: Faction; ai: boolean; team: "you" | "foe";
  x: number; z: number; yaw: number; pitch: number; speed: number; steer: number;
  hull: number; hullMax: number; shield: number; shieldMax: number; baseShield: number;
  fireCd: number; ultCd: number; alive: boolean; respawn: number; cloak: number;
  boost: number; boostDmg: number; rammed: boolean; untargetable: number; root: number; jam: number;
  dmgMul: number; dmgMulT: number; nextCrit: boolean; recover: number; hurtT: number; guard: number;
  evadeCd: number; radius: number; ace: boolean; human: StepInput | null;
};

export type Bullet = {
  x: number; z: number; vx: number; vz: number; life: number; dmg: number;
  faction: Faction; r: number; homeId: number | null; own: boolean;
};

export type Relay = { x: number; z: number; own: -1 | 0 | 1; cap: number };
export type Fx =
  | { k: "shot"; x: number; z: number; big: boolean; you: boolean }
  | { k: "hit"; x: number; z: number; you: boolean; fromX: number; fromZ: number; dmg: number }
  | { k: "boom"; x: number; z: number }
  | { k: "flare"; x: number; z: number; yaw: number }
  | { k: "dive"; x: number; z: number; yaw: number }
  | { k: "ram"; x: number; z: number; yaw: number }
  | { k: "emp"; x: number; z: number }
  | { k: "cloak"; x: number; z: number }
  | { k: "mark"; x: number; z: number }
  | { k: "guard"; x: number; z: number }
  | { k: "jam"; x: number; z: number }
  | { k: "ping" }
  | { k: "down"; name: string };

export type Runner = {
  x: number; z: number; yaw: number; hull: number; hullMax: number; alive: boolean; radius: number;
  team: "you" | "foe"; faction: Faction; untargetable: number; cloak: number;
};

export type Match = {
  player: Craft; enemies: Craft[]; allies: Craft[]; bullets: Bullet[]; relays: Relay[];
  rocks: { x: number; z: number; r: number }[];
  pips: { eng: number; wep: number; def: number };
  pipFrom: { eng: number; wep: number; def: number };
  pipTo: { eng: number; wep: number; def: number };
  ramp: number; presetCd: number; preset: PresetId; time: number; youBar: number; foeBar: number;
  kills: number; deaths: number; lockId: number | null; painted: number[]; fx: Fx[];
  over: null | "win" | "loss" | "draw"; refit: number; playerFaction: Faction; pace: Pace; limit: number;
  goal: Goal; disc: Disc; tech: "stick" | "barrels" | "mark" | null; runner: Runner | null; seed: number;
};

export type StepInput = {
  throttle: number; yaw: number; strafe: number; pitch: number; fire: boolean; ult: boolean;
  lock: boolean; evade: number; preset: PresetId | null;
};

export type MatchSetup = {
  allyCount?: number;
  foeCount?: number;
  goal?: Goal;
  disc?: Disc;
  tech?: "stick" | "barrels" | "mark" | null;
  seed?: number;
};

function field(disc: Disc) {
  if (disc === "dust") {
    return {
      relays: [
        { x: 36, z: 24, own: 0, cap: 0 },
        { x: -36, z: -8, own: 0, cap: 0 },
        { x: 34, z: -40, own: 0, cap: 0 },
      ],
      rocks: [
        { x: 22, z: 18, r: 2.8 },
        { x: -22, z: 6, r: 3 },
        { x: 24, z: -12, r: 2.6 },
        { x: -24, z: -24, r: 3.1 },
        { x: 20, z: -42, r: 2.4 },
        { x: -20, z: -52, r: 2.7 },
      ],
    };
  }
  if (disc === "beacon") return {
    relays: [
      {
        x: 20,
        z: 8,
        own: 0,
        cap: 0
      },
      {
        x: -16,
        z: 12,
        own: 0,
        cap: 0
      },
      {
        x: 2,
        z: -10,
        own: 0,
        cap: 0
      }
    ],
    rocks: [
      {
        x: 32,
        z: 22,
        r: 2.4
      },
      {
        x: -30,
        z: -8,
        r: 3
      },
      {
        x: 18,
        z: -24,
        r: 2.5
      }
    ]
  };
  if (disc === "night") return {
    relays: [
      {
        x: 42,
        z: 16,
        own: 0,
        cap: 0
      },
      {
        x: -38,
        z: 20,
        own: 0,
        cap: 0
      },
      {
        x: 6,
        z: -40,
        own: 0,
        cap: 0
      }
    ],
    rocks: [
      {
        x: 14,
        z: 8,
        r: 3.1
      },
      {
        x: -12,
        z: 4,
        r: 2.6
      },
      {
        x: 8,
        z: -8,
        r: 3.4
      },
      {
        x: -22,
        z: -18,
        r: 2.8
      },
      {
        x: 28,
        z: -16,
        r: 3
      },
      {
        x: -4,
        z: -28,
        r: 2.4
      },
      {
        x: 36,
        z: 30,
        r: 2.2
      }
    ]
  };
  return {
    relays: [
      {
        x: 34,
        z: 8,
        own: 0,
        cap: 0
      },
      {
        x: -16,
        z: 30,
        own: 0,
        cap: 0
      },
      {
        x: -16,
        z: -28,
        own: 0,
        cap: 0
      }
    ],
    rocks: [
      {
        x: 12,
        z: 12,
        r: 3.3
      },
      {
        x: -18,
        z: 6,
        r: 2.7
      },
      {
        x: 6,
        z: -16,
        r: 3.5
      },
      {
        x: -6,
        z: -30,
        r: 2.5
      },
      {
        x: 26,
        z: -6,
        r: 2.9
      },
      {
        x: -32,
        z: 16,
        r: 3.2
      },
      {
        x: 20,
        z: 28,
        r: 2.3
      }
    ]
  };
}
export function matchLimit(pace: Pace) {
  return pace === "strike" ? 360 : 120;
}
var nextId = 1;
export function wrap(a: number) {
  let v = a;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  return v;
}
export function engMul(eng: number) {
  return eng <= 2 ? .7 + (eng - 1) * .3 : 1 + (eng - 2) * .15;
}
export function wepMul(wep: number) {
  return wep <= 2 ? .75 + (wep - 1) * .25 : 1 + (wep - 2) * .125;
}
export function defMul(def: number) {
  return def <= 2 ? .85 + (def - 1) * .15 : 1 + (def - 2) * .2;
}
export function roll(match: Match) {
  let seed = match.seed | 0;
  seed = (seed + 0x6d2b79f5) | 0;
  match.seed = seed >>> 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function craft(ship: ShipId, ai: boolean, team: "you" | "foe", x: number, z: number, yaw: number, bonus: number): Craft {
  const def = SHIPS[ship];
  const shield = def.shield * bonus;
  const hull = def.hull * bonus;
  return {
    id: nextId++,
    ship,
    faction: def.faction,
    ai,
    team,
    x,
    z,
    yaw,
    pitch: 0,
    speed: 0,
    steer: 0,
    hull,
    hullMax: hull,
    shield,
    shieldMax: shield,
    baseShield: shield,
    fireCd: ai ? .4 : 0,
    ultCd: 0,
    alive: true,
    respawn: 0,
    cloak: 0,
    boost: 0,
    boostDmg: 0,
    rammed: false,
    untargetable: 0,
    root: 0,
    jam: 0,
    dmgMul: 1,
    dmgMulT: 0,
    nextCrit: false,
    recover: 0,
    hurtT: 0,
    guard: ai ? .6 : 2.4,
    evadeCd: 0,
    radius: def.radius,
    ace: false,
    human: null
  };
}
export function createMatch(shipId: ShipId, faction: Faction, refit: number, pace: Pace = "practice", setup: MatchSetup = {}): Match {
  nextId = 1;
  const player = craft(shipId, false, "you", 0, 28, 0, refitMul(refit));
  const mine = ROSTER[faction];
  const allyIds = mine.filter((id) => id !== shipId);
  while (allyIds.length < 4) allyIds.push(mine[allyIds.length % mine.length]);
  const allySpots = [
    {
      x: -9,
      z: 18
    },
    {
      x: 9,
      z: 18
    },
    {
      x: -16,
      z: 34
    },
    {
      x: 16,
      z: 34
    }
  ];
  const allyCount = Math.max(1, Math.min(4, setup.allyCount ?? 4));
  const foeCount = Math.max(1, Math.min(5, setup.foeCount ?? 5));
  const allies = allyIds.slice(0, allyCount).map((id, i) => {
    const s = allySpots[i];
    return craft(id, true, "you", s.x, s.z, 0, 1);
  });
  const foeRoster = ROSTER[otherFaction(faction)];
  const foeShips = [...foeRoster, foeRoster[1]].slice(0, foeCount);
  const foeSpots = [
    {
      x: -18,
      z: -6
    },
    {
      x: 18,
      z: -4
    },
    {
      x: 0,
      z: -18
    },
    {
      x: -12,
      z: -28
    },
    {
      x: 14,
      z: -24
    }
  ];
  const enemies = foeShips.map((id, i) => {
    const s = foeSpots[i];
    const yaw = Math.atan2(-(player.x - s.x), -(player.z - s.z));
    return craft(id, true, "foe", s.x, s.z, yaw, 1);
  });
  const goal = setup.goal ?? "disc";
  const disc = setup.disc ?? "rust";
  const ground = field(disc);
  if (goal === "ace" && enemies.length > 0) {
    const warden = enemies[enemies.length - 1];
    warden.ace = true;
    warden.hull *= 1.7;
    warden.hullMax *= 1.7;
    warden.shield *= 1.45;
    warden.shieldMax *= 1.45;
    warden.baseShield *= 1.45;
  }
  return {
    player,
    enemies,
    allies,
    bullets: [],
    relays: ground.relays as Relay[],
    rocks: ground.rocks,
    pips: {
      eng: 2,
      wep: 2,
      def: 2
    },
    pipFrom: {
      eng: 2,
      wep: 2,
      def: 2
    },
    pipTo: {
      eng: 2,
      wep: 2,
      def: 2
    },
    ramp: 1,
    presetCd: 0,
    preset: 0,
    time: 0,
    youBar: 100,
    foeBar: 100,
    kills: 0,
    deaths: 0,
    lockId: null,
    painted: [],
    fx: [],
    over: null,
    refit,
    playerFaction: faction,
    pace,
    limit: matchLimit(pace),
    goal,
    disc,
    tech: setup.tech === "stick" || setup.tech === "barrels" || setup.tech === "mark" ? setup.tech : null,
    seed: (setup.seed ?? 1) >>> 0 || 1,
    runner: goal === "extract" ? {
      x: 0,
      z: 46,
      yaw: 0,
      hull: 640,
      hullMax: 640,
      alive: true,
      radius: 2.3,
      team: faction === "ussf" ? "you" : "foe",
      faction: "ussf",
      untargetable: 0,
      cloak: 0
    } : null
  };
}
export function relaysHeld(match: Match) {
  return match.relays.filter((r) => r.own === 1).length;
}
function pushFx(match: Match, fx: Fx) {
  if (match.fx.length > 28) match.fx.shift();
  match.fx.push(fx);
}
function kill(match: Match, c: Craft) {
  if (!c.alive) return;
  c.alive = false;
  c.hull = 0;
  c.speed = 0;
  c.respawn = 3.4;
  c.cloak = 0;
  c.boost = 0;
  pushFx(match, {
    k: "boom",
    x: c.x,
    z: c.z
  });
  const strike = match.pace === "strike";
  if (c.team === "foe") {
    match.kills += 1;
    match.foeBar = Math.max(0, match.foeBar - (strike ? 8 : 14));
    if (match.lockId === c.id) match.lockId = null;
    pushFx(match, { k: "down", name: SHIPS[c.ship].name });
  } else if (c.ai) match.youBar = Math.max(0, match.youBar - (strike ? 6 : 12));
  else {
    match.deaths += 1;
    match.youBar = Math.max(0, match.youBar - (strike ? 10 : 18));
    match.lockId = null;
  }
  if (c.ace) match.over = "win";
}
function hurt(match: Match, c: Craft, dmg: number, fromX?: number, fromZ?: number) {
  if (!c.alive || c.guard > 0 || c.untargetable > 0) return false;
  let left = dmg;
  const absorbed = Math.min(c.shield, left);
  c.shield -= absorbed;
  left -= absorbed;
  c.hull -= left;
  c.hurtT = 2;
  c.cloak = 0;
  pushFx(match, {
    k: "hit",
    x: c.x,
    z: c.z,
    you: c.team === "you" && !c.ai,
    fromX: fromX ?? c.x,
    fromZ: fromZ ?? c.z,
    dmg
  });
  if (c.hull <= 0) kill(match, c);
  return true;
}
export function aimYaw(fromX: number, fromZ: number, toX: number, toZ: number) {
  return Math.atan2(-(toX - fromX), -(toZ - fromZ));
}
function tickTimers(c: Craft, dt: number) {
  c.fireCd = Math.max(0, c.fireCd - dt);
  c.ultCd = Math.max(0, c.ultCd - dt);
  c.cloak = Math.max(0, c.cloak - dt);
  c.jam = Math.max(0, c.jam - dt);
  c.guard = Math.max(0, c.guard - dt);
  c.untargetable = Math.max(0, c.untargetable - dt);
  c.dmgMulT = Math.max(0, c.dmgMulT - dt);
  c.hurtT = Math.max(0, c.hurtT - dt);
  c.evadeCd = Math.max(0, c.evadeCd - dt);
  c.root = Math.max(0, c.root - dt);
  c.boost = Math.max(0, c.boost - dt);
  c.recover = Math.max(0, c.recover - dt);
}
function moveCraft(match: Match, c: Craft, steer: number, throttle: number, strafe: number, dt: number, speedMul: number) {
  const def = SHIPS[c.ship];
  let maxSp = def.maxSpeed * speedMul;
  let useSteer = steer;
  let useThrottle = throttle;
  let useStrafe = strafe;
  if (c.root > 0) {
    useSteer = 0;
    useThrottle = 0;
    useStrafe = 0;
    c.speed = 0;
    maxSp = 0;
  } else if (c.boost > 0) {
    useThrottle = 1;
    maxSp *= 1.9;
  }
  if (c.recover > 0) maxSp *= .45;
  const accel = def.accel * Math.max(.7, speedMul);
  const target = Math.max(-1, Math.min(1, useThrottle)) * maxSp;
  if (c.speed < target) c.speed = Math.min(target, c.speed + accel * dt);
  else c.speed = Math.max(target, c.speed - accel * dt);
  let rate = def.turnRate * def.handling * (c.ai ? .84 : 1);
  if (!c.ai && match.tech === "stick") rate *= 1.12;
  c.yaw = wrap(c.yaw + Math.max(-1, Math.min(1, useSteer)) * rate * dt);
  c.steer = useSteer;
  const strafeSpeed = def.maxSpeed * .8;
  c.x += -Math.cos(c.yaw) * useStrafe * strafeSpeed * dt;
  c.z += Math.sin(c.yaw) * useStrafe * strafeSpeed * dt;
  c.x += -Math.sin(c.yaw) * c.speed * dt;
  c.z += -Math.cos(c.yaw) * c.speed * dt;
  const dist = Math.hypot(c.x, c.z);
  if (dist > ARENA_R) {
    c.x = c.x / dist * ARENA_R;
    c.z = c.z / dist * ARENA_R;
    if (c.speed > 0) c.speed *= .35;
  }
  for (const rock of match.rocks) {
    const dx = c.x - rock.x;
    const dz = c.z - rock.z;
    const d = Math.hypot(dx, dz);
    const min = rock.r + c.radius * .85;
    if (d < min && d > .001) {
      c.x = rock.x + dx / d * min;
      c.z = rock.z + dz / d * min;
    }
  }
}
function fire(match: Match, c: Craft, speedMulWep: number) {
  if (!c.alive || c.fireCd > 0 || c.root > 0) return;
  if (match.bullets.length > 110) return;
  const def = SHIPS[c.ship];
  c.fireCd = def.fireInterval / speedMulWep;
  if (!c.ai && match.tech === "barrels") c.fireCd *= .88;
  let dmg = def.shotDmg * Math.sqrt(speedMulWep);
  if (c.ai && !c.human) dmg *= .46;
  else dmg *= 1 + match.refit * .04;
  if (!c.ai && c.dmgMulT > 0) dmg *= c.dmgMul;
  let big = false;
  if (!c.ai && c.nextCrit) {
    dmg *= 2.45;
    c.nextCrit = false;
    big = true;
  }
  if (c.cloak > 0) c.cloak = 0;
  const spread = c.ai ? (roll(match) - .5) * .16 : 0;
  const yaw = c.yaw + spread;
  const sp = def.shotSpeed;
  const nose = c.radius + .7;
  match.bullets.push({
    x: c.x + -Math.sin(yaw) * nose,
    z: c.z + -Math.cos(yaw) * nose,
    vx: -Math.sin(yaw) * sp,
    vz: -Math.cos(yaw) * sp,
    life: def.id === "sundara" ? 2.3 : 1.35,
    dmg,
    faction: c.faction,
    r: def.id === "sundara" ? .72 : .34,
    homeId: !c.ai && def.id === "sundara" ? match.lockId : null,
    own: !c.ai
  });
  pushFx(match, {
    k: "shot",
    x: c.x,
    z: c.z,
    big,
    you: !c.ai
  });
}
function opposing(match: Match, c: Craft) {
  return c.team === "foe" ? [match.player, ...match.allies] : match.enemies;
}
function flyHuman(match: Match, c: Craft, input: StepInput, dt: number) {
  moveCraft(match, c, input.yaw, input.throttle, input.strafe, dt, 1);
  if (input.fire) fire(match, c, 1);
  if (input.ult) triggerUlt(match, c);
  c.human = null;
}
function triggerUlt(match: Match, c: Craft) {
  if (!c.alive || c.ultCd > 0) return;
  const def = SHIPS[c.ship];
  c.ultCd = def.ultCd;
  if (c.ship === "mandjet") {
    c.speed *= .3;
    pushFx(match, {
      k: "flare",
      x: c.x,
      z: c.z,
      yaw: c.yaw
    });
    const foes = opposing(match, c);
    for (const e of foes) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - c.x, e.z - c.z) > 30) continue;
      if (Math.abs(wrap(aimYaw(c.x, c.z, e.x, e.z) - c.yaw)) < .46) hurt(match, e, 36);
    }
  } else if (c.ship === "shakuna") {
    c.boost = .48;
    c.boostDmg = 18;
    c.rammed = false;
    c.speed = def.maxSpeed * 1.7;
    pushFx(match, { k: "dive", x: c.x, z: c.z, yaw: c.yaw });
  } else if (c.ship === "sundara") {
    c.cloak = 4;
    c.nextCrit = true;
    pushFx(match, { k: "cloak", x: c.x, z: c.z });
  } else if (c.ship === "tripura") {
    pushFx(match, {
      k: "emp",
      x: c.x,
      z: c.z
    });
    const foes = opposing(match, c);
    for (const e of foes) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - c.x, e.z - c.z) < 20) e.root = Math.max(e.root, 1.15);
    }
  } else if (c.ship === "duskbreaker") {
    c.dmgMul = 1.5;
    c.dmgMulT = 3.2;
    if (c.id === match.player.id && match.lockId == null) {
      let best = null;
      let bestAbs = 1;
      for (const e of opposing(match, c)) {
        if (!e.alive) continue;
        const ang = Math.abs(wrap(aimYaw(c.x, c.z, e.x, e.z) - c.yaw));
        if (ang < bestAbs) {
          bestAbs = ang;
          best = e;
        }
      }
      if (best && bestAbs < .7) match.lockId = best.id;
    }
    const marked = opposing(match, c).find((e) => e.id === match.lockId && e.alive);
    pushFx(match, { k: "mark", x: marked ? marked.x : c.x, z: marked ? marked.z : c.z });
  } else if (c.ship === "sentinel") {
    c.shield = c.shieldMax;
    c.guard = Math.max(c.guard, 1.35);
    pushFx(match, { k: "guard", x: c.x, z: c.z });
  } else if (c.ship === "splitter") {
    for (const e of opposing(match, c)) if (e.alive) e.jam = Math.max(e.jam, 3.2);
    pushFx(match, { k: "jam", x: c.x, z: c.z });
  } else if (c.ship === "glide") {
    c.untargetable = 1.15;
    c.boost = 1.15;
    c.boostDmg = 42;
    c.rammed = false;
    c.speed = def.maxSpeed * 1.65;
    pushFx(match, { k: "ram", x: c.x, z: c.z, yaw: c.yaw });
  }
}
function cycleLock(match: Match) {
  const player = match.player;
  const alive = match.enemies.filter((e) => e.alive);
  if (alive.length === 0) {
    match.lockId = null;
    return;
  }
  const cone = alive.filter((e) => Math.abs(wrap(aimYaw(player.x, player.z, e.x, e.z) - player.yaw)) < .4);
  const pool = cone.length > 0 ? cone : alive;
  const idx = pool.findIndex((e) => e.id === match.lockId);
  if (pool.length === 1 && pool[0].id === match.lockId) {
    match.lockId = null;
    return;
  }
  match.lockId = pool[(idx + 1) % pool.length].id;
}
function steerAi(match: Match, e: Craft, dt: number) {
  const hostile = e.team === "foe";
  const quarry: { x: number; z: number; alive: boolean; untargetable: number; cloak: number }[] = (hostile ? [match.player, ...match.allies] : match.enemies).filter((c) => c.alive && c.untargetable <= 0 && c.cloak <= 0);
  if (match.runner?.alive && match.runner.team !== e.team) quarry.push(match.runner);
  if (e.jam > 0) {
    moveCraft(match, e, Math.sin(match.time * 2.4 + e.id), .35, 0, dt, .9);
    return;
  }
  let tx = 0;
  let tz = 0;
  let chase = null;
  let bestD = match.goal === "extract" ? 74 : 42;
  for (const q of quarry) {
    const d = Math.hypot(q.x - e.x, q.z - e.z);
    if (d < bestD) {
      bestD = d;
      chase = q;
    }
  }
  if (chase) {
    tx = chase.x;
    tz = chase.z;
  } else {
    let best = match.relays[0];
    let bd = 1e9;
    const owned = hostile ? -1 : 1;
    for (const r of match.relays) {
      if (r.own === owned) continue;
      const d = Math.hypot(r.x - e.x, r.z - e.z);
      if (d < bd) {
        bd = d;
        best = r;
      }
    }
    if (match.relays.every((r) => r.own === owned) && quarry.length > 0) {
      tx = quarry[0].x;
      tz = quarry[0].z;
      chase = quarry[0];
    } else {
      tx = best.x;
      tz = best.z;
    }
  }
  const diff = wrap(aimYaw(e.x, e.z, tx, tz) - e.yaw);
  moveCraft(match, e, Math.max(-1, Math.min(1, diff / .42)), Math.abs(diff) < .9 ? 1 : .4, 0, dt, hostile ? .9 : .96);
  if (chase && Math.abs(diff) < .3 && Math.hypot(chase.x - e.x, chase.z - e.z) < 46) fire(match, e, 1);
  const mates = hostile ? match.enemies : [match.player, ...match.allies];
  for (const o of mates) {
    if (o === e || !o.alive) continue;
    const dx = e.x - o.x;
    const dz = e.z - o.z;
    const d = Math.hypot(dx, dz);
    if (d < 5.5 && d > .01) {
      e.x += dx / d * 4 * dt;
      e.z += dz / d * 4 * dt;
    }
  }
}
function respawn(match: Match, c: Craft) {
  const angle = roll(match) * Math.PI * 2;
  const rad = ARENA_R * 0.72;
  c.x = Math.cos(angle) * rad;
  c.z = Math.sin(angle) * rad;
  const focus = (c.team === "foe" ? [match.player, ...match.allies] : match.enemies).find((e) => e.alive) ?? match.player;
  c.yaw = aimYaw(c.x, c.z, focus.x, focus.z);
  c.speed = 0;
  c.hull = c.hullMax;
  c.shield = c.shieldMax;
  c.alive = true;
  c.guard = 1.3;
  c.root = 0;
  c.jam = 0;
  c.cloak = 0;
  c.boost = 0;
}
function boostHits(match: Match, c: Craft) {
  if (c.boost <= 0 || c.boostDmg <= 0 || c.rammed) return;
  const targets = c.team === "foe" ? [match.player, ...match.allies] : match.enemies;
  for (const o of targets) {
    if (!o.alive || o.guard > 0) continue;
    if (Math.hypot(o.x - c.x, o.z - c.z) < c.radius + o.radius + .7) {
      hurt(match, o, c.boostDmg, c.x, c.z);
      c.rammed = true;
      if (c.ship === "glide") {
        c.boost = 0;
        c.recover = 1.35;
        c.untargetable = 0;
      }
      break;
    }
  }
}
function hurtRunner(match: Match, dmg: number, fromX?: number, fromZ?: number) {
  const runner = match.runner;
  if (!runner || !runner.alive) return false;
  runner.hull -= dmg;
  pushFx(match, {
    k: "hit",
    x: runner.x,
    z: runner.z,
    you: false,
    fromX: fromX ?? runner.x,
    fromZ: fromZ ?? runner.z,
    dmg
  });
  if (runner.hull <= 0) {
    runner.alive = false;
    runner.hull = 0;
    pushFx(match, { k: "boom", x: runner.x, z: runner.z });
    match.over = runner.team === "you" ? "loss" : "win";
  }
  return true;
}
function tickRunner(match: Match, dt: number) {
  const runner = match.runner;
  if (!runner || !runner.alive) return;
  runner.yaw = 0;
  runner.z -= 1.65 * dt;
  for (const rock of match.rocks) {
    const dx = runner.x - rock.x;
    const dz = runner.z - rock.z;
    const d = Math.hypot(dx, dz);
    const min = rock.r + runner.radius;
    if (d < min && d > 0.001) {
      runner.x = rock.x + (dx / d) * min;
      runner.z = rock.z + (dz / d) * min;
    }
  }
}
export function step(match: Match, input: StepInput, dt: number) {
  if (match.over) return;
  const player = match.player;
  match.presetCd = Math.max(0, match.presetCd - dt);
  if (input.preset != null && match.presetCd <= 0 && input.preset !== match.preset) {
    const next = PRESET_PIPS[input.preset];
    if (next) {
      match.preset = input.preset;
      match.pipFrom = { ...match.pips };
      const [eng, wep, def] = next;
      match.pipTo = {
        eng,
        wep,
        def
      };
      match.ramp = 0;
      match.presetCd = 4;
    }
  }
  if (match.ramp < 1) {
    match.ramp = Math.min(1, match.ramp + dt / .35);
    const u = match.ramp;
    match.pips.eng = match.pipFrom.eng + (match.pipTo.eng - match.pipFrom.eng) * u;
    match.pips.wep = match.pipFrom.wep + (match.pipTo.wep - match.pipFrom.wep) * u;
    match.pips.def = match.pipFrom.def + (match.pipTo.def - match.pipFrom.def) * u;
  }
  player.shieldMax = player.baseShield * defMul(match.pips.def);
  if (player.shield > player.shieldMax) player.shield = player.shieldMax;
  const glideBoosting = player.alive && player.ship === "glide" && player.boost > 0 && !player.rammed;
  tickTimers(player, dt);
  for (const mate of match.allies) tickTimers(mate, dt);
  for (const e of match.enemies) tickTimers(e, dt);
  if (player.alive) {
    const mul = engMul(match.pips.eng);
    if (input.evade !== 0 && player.evadeCd <= 0 && player.root <= 0) {
      player.x += -Math.cos(player.yaw) * input.evade * 5.2;
      player.z += Math.sin(player.yaw) * input.evade * 5.2;
      player.evadeCd = 1.15;
    }
    moveCraft(match, player, input.yaw, input.throttle, input.strafe, dt, mul);
    const wantPitch = Math.max(-1, Math.min(1, input.pitch)) * .42;
    player.pitch += (wantPitch - player.pitch) * Math.min(1, dt * 7);
    if (input.fire) fire(match, player, wepMul(match.pips.wep));
    if (input.ult) triggerUlt(match, player);
    if (input.lock) cycleLock(match);
    if (player.hurtT <= 0) player.shield = Math.min(player.shieldMax, player.shield + 16 * dt);
    else if (match.pips.def >= 3.15) player.shield = Math.min(player.shieldMax, player.shield + 6 * dt);
    boostHits(match, player);
    if (glideBoosting && player.boost <= 0) {
      player.recover = Math.max(player.recover, 1.35);
      player.untargetable = 0;
    }
  } else {
    player.respawn -= dt;
    if (player.respawn <= 0 && match.youBar > 0) respawn(match, player);
  }
  for (const mate of match.allies) {
    if (!mate.alive) {
      mate.respawn -= dt;
      if (mate.respawn <= 0 && match.youBar > 0) respawn(match, mate);
      continue;
    }
    if (mate.human) flyHuman(match, mate, mate.human, dt);
    else steerAi(match, mate, dt);
    boostHits(match, mate);
    if (mate.hurtT <= 0) mate.shield = Math.min(mate.shieldMax, mate.shield + 5 * dt);
  }
  for (const e of match.enemies) {
    if (!e.alive) {
      e.respawn -= dt;
      if (e.respawn <= 0 && match.foeBar > 0 && !e.ace) respawn(match, e);
      continue;
    }
    if (e.human) flyHuman(match, e, e.human, dt);
    else steerAi(match, e, dt);
    boostHits(match, e);
    if (e.hurtT <= 0) e.shield = Math.min(e.shieldMax, e.shield + 5 * dt);
  }
  for (let i = match.bullets.length - 1; i >= 0; i--) {
    const b = match.bullets[i];
    if (b.homeId != null) {
      const target = match.enemies.find((e) => e.id === b.homeId && e.alive);
      if (target) {
        const yaw = Math.atan2(-b.vx, -b.vz);
        const want = aimYaw(b.x, b.z, target.x, target.z);
        const ny = yaw + Math.max(-2.4 * dt, Math.min(2.4 * dt, wrap(want - yaw)));
        const sp = Math.hypot(b.vx, b.vz);
        b.vx = -Math.sin(ny) * sp;
        b.vz = -Math.cos(ny) * sp;
      }
    }
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      for (const rock of match.rocks) if (Math.hypot(rock.x - b.x, rock.z - b.z) < rock.r) {
        dead = true;
        break;
      }
    }
    if (!dead && match.runner?.alive && match.runner.faction !== b.faction) {
      const cage = match.runner;
      if (Math.hypot(cage.x - b.x, cage.z - b.z) < cage.radius + b.r) {
        if (hurtRunner(match, b.dmg, b.x, b.z) && b.own) pushFx(match, { k: "ping" });
        dead = true;
      }
    }
    if (!dead) {
      const targets = b.faction === match.playerFaction ? match.enemies : [player, ...match.allies];
      for (const t of targets) {
        if (!t.alive) continue;
        if (Math.hypot(t.x - b.x, t.z - b.z) < t.radius + b.r) {
          const landed = hurt(match, t, b.own && match.tech === "mark" && t.id === match.lockId ? b.dmg * 1.22 : b.dmg, b.x, b.z);
          if (landed && b.own) pushFx(match, { k: "ping" });
          dead = true;
          break;
        }
      }
    }
    if (dead) match.bullets.splice(i, 1);
  }
  for (const r of match.relays) {
    const friendNear = player.alive && Math.hypot(player.x - r.x, player.z - r.z) < 9 || match.allies.some((a) => a.alive && Math.hypot(a.x - r.x, a.z - r.z) < 9);
    const enemyNear = match.enemies.some((e) => e.alive && Math.hypot(e.x - r.x, e.z - r.z) < 9);
    if (friendNear && !enemyNear) r.cap = Math.min(1, r.cap + dt * .42);
    else if (enemyNear && !friendNear) r.cap = Math.max(-1, r.cap - dt * .42);
    r.own = r.cap > .58 ? 1 : r.cap < -.58 ? -1 : 0;
  }
  const yours = match.relays.filter((r) => r.own === 1).length;
  const theirs = match.relays.filter((r) => r.own === -1).length;
  const drain = match.pace === "strike" ? .85 : 3.4;
  if (yours >= 2) match.foeBar = Math.max(0, match.foeBar - drain * dt);
  if (theirs >= 2) match.youBar = Math.max(0, match.youBar - drain * dt);
  tickRunner(match, dt);
  match.time += dt;
  if (match.goal === "extract" && match.runner) {
    const cage = match.runner;
    if (!match.over && !cage.alive) match.over = cage.team === "you" ? "loss" : "win";
    else if (!match.over && cage.z <= -68) match.over = cage.team === "you" ? "win" : "loss";
    else if (!match.over && match.youBar <= 0) match.over = "loss";
    else if (!match.over && match.time >= match.limit) match.over = cage.team === "you" ? "loss" : "win";
  } else if (match.goal === "beacons" && yours >= 2) match.over = "win";
  else if (match.foeBar <= 0 && match.goal !== "ace") match.over = "win";
  else if (match.youBar <= 0) match.over = "loss";
  else if (match.time >= match.limit) {
    if (match.goal === "ace") match.over = "loss";
    else if (match.goal === "beacons") match.over = yours >= 2 ? "win" : "loss";
    else match.over = match.youBar > match.foeBar ? "win" : match.youBar < match.foeBar ? "loss" : "draw";
  }
  match.painted = hostilePaint(match);
}

function hostilePaint(match: Match) {
  const player = match.player;
  const ids: number[] = [];
  if (!player.alive) return ids;
  for (const e of match.enemies) {
    if (!e.alive || e.cloak > 0) continue;
    const d = Math.hypot(e.x - player.x, e.z - player.z);
    if (d > 52 || d < 0.2) continue;
    if (Math.abs(wrap(aimYaw(e.x, e.z, player.x, player.z) - e.yaw)) < 0.4) ids.push(e.id);
  }
  return ids;
}
