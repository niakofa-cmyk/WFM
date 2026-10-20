import { SHIPS, type Faction, type ShipDef, type ShipId } from "./ships";
import {
  aimYaw,
  createMatch,
  leadAimPoint,
  step,
  wrap,
  type Craft,
  type Match,
  type StepInput,
} from "./sim";

const TICK = 1 / 30;
const IDLE: StepInput = {
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
const ROLES = ["Vanguard", "Hunter", "Striker", "Support", "Raider"] as const;

type DuelResult = {
  duration: number;
  winner: "you" | "foe" | "draw";
  damageDealt: [number, number];
  damageReceived: [number, number];
  aliveSeconds: [number, number];
  firstDeathSeconds: [number, number];
  distance: [number, number];
  turnRadians: [number, number];
};

type RoleRecord = { matches: number; wins: number; draws: number; losses: number };
type MutableRow = {
  shipId: ShipId;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  damageDealt: number;
  damageReceived: number;
  aliveSeconds: number;
  totalSeconds: number;
  firstDeathSeconds: number;
  distance: number;
  turnRadians: number;
  opponentRoles: Record<string, RoleRecord>;
};

export type ShipCertificationRow = {
  shipId: ShipId;
  name: string;
  faction: Faction;
  role: string;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  avgDamageDealt: number;
  avgDamageReceived: number;
  avgFirstLifeSeconds: number;
  alivePercent: number;
  firstSecondDistance: number;
  distancePerAliveMinute: number;
  turnDegreesPerSecond: number;
  timeTo90PercentSpeed: number;
  handlingTurnDegreesPerSecond: number;
  abilityEffect: string;
  opponentRoles: Record<string, RoleRecord>;
};

function configureCraft(craft: Craft, shipId: ShipId, team: "you" | "foe", ai: boolean) {
  const ship = SHIPS[shipId];
  craft.ship = shipId;
  craft.faction = ship.faction;
  craft.team = team;
  craft.ai = ai;
  craft.human = null;
  craft.hullMax = ship.hull;
  craft.hull = ship.hull;
  craft.shieldMax = ship.shield;
  craft.shield = ship.shield;
  craft.baseShield = ship.shield;
  craft.radius = ship.radius;
  craft.alive = true;
  craft.respawn = 0;
  craft.speed = 0;
  craft.steer = 0;
  craft.fireCd = 0;
  craft.ultCd = 0;
  craft.cloak = 0;
  craft.boost = 0;
  craft.boostDmg = 0;
  craft.rammed = false;
  craft.untargetable = 0;
  craft.root = 0;
  craft.jam = 0;
  craft.dmgMul = 1;
  craft.dmgMulT = 0;
  craft.nextCrit = false;
  craft.recover = 0;
  craft.hurtT = 0;
  craft.guard = 0;
  craft.evadeCd = 0;
  craft.ace = false;
}

function createDuel(playerShip: ShipId, opponentShip: ShipId, seed: number, durationSeconds: number) {
  const playerFaction = SHIPS[playerShip].faction;
  const match = createMatch(playerShip, playerFaction, 0, "strike", {
    goal: "disc",
    seed,
    allyCount: 1,
    foeCount: 1,
  });
  const opponent = match.enemies[0];
  match.playerFaction = playerFaction;
  match.allies = [];
  match.enemies = [opponent];
  match.limit = durationSeconds;
  match.over = null;
  match.youBar = 100;
  match.foeBar = 100;
  match.bullets = [];
  match.fx = [];
  configureCraft(match.player, playerShip, "you", false);
  configureCraft(opponent, opponentShip, "foe", false);
  const lateralOffset = ((seed % 13) - 6) * 0.3;
  match.player.x = lateralOffset;
  match.player.z = 10;
  opponent.x = -lateralOffset;
  opponent.z = 0;
  match.player.yaw = aimYaw(match.player.x, match.player.z, opponent.x, opponent.z);
  opponent.yaw = aimYaw(opponent.x, opponent.z, match.player.x, match.player.z);
  match.rocks = [];
  match.relays.forEach((relay) => {
    relay.x = 500;
    relay.z = 500;
  });
  return { match, player: match.player, opponent };
}

function policyInput(match: Match, craft: Craft, target: Craft, targetMotion: Craft, orbitPhase: number): StepInput {
  const ship: ShipDef = SHIPS[craft.ship];
  const range = Math.hypot(target.x - craft.x, target.z - craft.z);
  const targetYaw = aimYaw(craft.x, craft.z, target.x, target.z);
  const steeringError = wrap(targetYaw - craft.yaw);
  const needsLock = craft.id === match.player.id
    && (craft.ship === "sundara" || craft.ship === "duskbreaker")
    && match.lockId !== target.id
    && Math.abs(steeringError) < 0.4;
  const shotPoint = leadAimPoint(craft.x, craft.z, targetMotion, ship.shotSpeed);
  const shotError = wrap(aimYaw(craft.x, craft.z, shotPoint.x, shotPoint.z) - craft.yaw);

  let ult = false;
  if (craft.ultCd <= TICK) {
    if (craft.ship === "mandjet") ult = range < 29 && Math.abs(steeringError) < 0.46;
    else if (craft.ship === "shakuna") ult = range < 12 && Math.abs(steeringError) < 0.4;
    else if (craft.ship === "sundara") ult = range < 50 && !craft.nextCrit;
    else if (craft.ship === "tripura") ult = range < 19;
    else if (craft.ship === "duskbreaker") ult = range < 55;
    else if (craft.ship === "sentinel") ult = craft.shield < craft.shieldMax * 0.58 || craft.hull < craft.hullMax * 0.62;
    else if (craft.ship === "splitter") ult = range < 65;
    else if (craft.ship === "glide") ult = range < 15 && Math.abs(steeringError) < 0.4;
  }

  return {
    throttle: Math.max(-0.7, Math.min(0.7, (range - 17) / 16)),
    yaw: Math.max(-1, Math.min(1, steeringError / 0.42)),
    strafe: Math.sin(match.time * 1.7 + craft.id * 0.73 + orbitPhase) * 0.58,
    pitch: 0,
    fire: range < 46 && Math.abs(shotError) < 0.32,
    ult,
    lock: needsLock,
    evade: 0,
    preset: null,
  };
}

function runDuel(playerShip: ShipId, opponentShip: ShipId, seed: number, durationSeconds: number): DuelResult {
  const { match, player, opponent } = createDuel(playerShip, opponentShip, seed, durationSeconds);
  const maxTicks = Math.ceil(durationSeconds / TICK);
  const orbitPhase = ((seed % 997) / 997) * Math.PI * 2;
  const previousPositions = new Map<number, { x: number; z: number }>([
    [player.id, { x: player.x, z: player.z }],
    [opponent.id, { x: opponent.x, z: opponent.z }],
  ]);
  const estimateMotion = (craft: Craft): Craft => {
    const previous = previousPositions.get(craft.id);
    if (!previous) return craft;
    const dx = craft.x - previous.x;
    const dz = craft.z - previous.z;
    const speed = Math.hypot(dx, dz) / TICK;
    return speed > 0.1
      ? { ...craft, speed, yaw: Math.atan2(-dx, -dz) }
      : { ...craft, speed: 0 };
  };
  let aliveSeconds: [number, number] = [0, 0];
  let firstDeathSeconds: [number, number] = [durationSeconds, durationSeconds];
  let hasDied: [boolean, boolean] = [false, false];
  let distance: [number, number] = [0, 0];
  let turnRadians: [number, number] = [0, 0];
  let damageReceived: [number, number] = [0, 0];

  for (let tick = 0; tick < maxTicks && !match.over; tick += 1) {
    const before = [
      { x: player.x, z: player.z, yaw: player.yaw, alive: player.alive },
      { x: opponent.x, z: opponent.z, yaw: opponent.yaw, alive: opponent.alive },
    ];
    const playerInput = policyInput(match, player, opponent, estimateMotion(opponent), orbitPhase);
    opponent.human = policyInput(match, opponent, player, estimateMotion(player), orbitPhase);
    step(match, playerInput, TICK);
    previousPositions.set(player.id, { x: player.x, z: player.z });
    previousPositions.set(opponent.id, { x: opponent.x, z: opponent.z });

    for (const event of match.fx) {
      if (event.k !== "hit") continue;
      const playerDistance = Math.hypot(event.x - player.x, event.z - player.z);
      const opponentDistance = Math.hypot(event.x - opponent.x, event.z - opponent.z);
      if (playerDistance + 0.01 < opponentDistance) damageReceived[0] += event.dmg;
      else if (opponentDistance + 0.01 < playerDistance) damageReceived[1] += event.dmg;
    }

    const crafts = [player, opponent];
    for (let side = 0; side < crafts.length; side += 1) {
      const craft = crafts[side];
      if (before[side].alive && craft.alive) {
        aliveSeconds[side] += TICK;
        const moved = Math.hypot(craft.x - before[side].x, craft.z - before[side].z);
        if (moved < 25) {
          distance[side] += moved;
          turnRadians[side] += Math.abs(wrap(craft.yaw - before[side].yaw));
        }
      }
      if (before[side].alive && !craft.alive && !hasDied[side]) {
        hasDied[side] = true;
        firstDeathSeconds[side] = match.time;
      }
    }
    match.fx.length = 0;
  }

  let winner: DuelResult["winner"] = "draw";
  if (match.over === "win") winner = "you";
  else if (match.over === "loss") winner = "foe";
  else if (match.youBar > match.foeBar) winner = "you";
  else if (match.foeBar > match.youBar) winner = "foe";

  const damageDealt: [number, number] = [damageReceived[1], damageReceived[0]];
  for (let side = 0; side < 2; side += 1) {
    if (!hasDied[side]) firstDeathSeconds[side] = Math.max(TICK, match.time);
  }
  return {
    duration: Math.max(TICK, match.time),
    winner,
    damageDealt,
    damageReceived,
    aliveSeconds,
    firstDeathSeconds,
    distance,
    turnRadians,
  };
}

function movementProbe(shipId: ShipId) {
  const faction = SHIPS[shipId].faction;
  const { match, player } = createDuel(shipId, faction === "accord" ? "duskbreaker" : "mandjet", 0x4d4f, 12);
  match.allies = [];
  match.enemies = [];
  match.relays.forEach((relay) => {
    relay.x = 500;
    relay.z = 500;
  });
  match.rocks = [];
  player.x = 0;
  player.z = 0;
  player.yaw = 0;
  player.speed = 0;
  player.ai = false;
  let timeTo90PercentSpeed = 1;
  let hasReached90 = false;
  let distanceInFirstSecond = 0;

  for (let tick = 0; tick < 60; tick += 1) {
    const previousX = player.x;
    const previousZ = player.z;
    step(match, { ...IDLE, throttle: 1 }, 1 / 60);
    distanceInFirstSecond += Math.hypot(player.x - previousX, player.z - previousZ);
    if (!hasReached90 && player.speed >= SHIPS[shipId].maxSpeed * 0.9) {
      timeTo90PercentSpeed = (tick + 1) / 60;
      hasReached90 = true;
    }
  }

  let turnRadians = 0;
  for (let tick = 0; tick < 120; tick += 1) {
    const previousYaw = player.yaw;
    step(match, { ...IDLE, yaw: 1 }, 1 / 60);
    turnRadians += Math.abs(wrap(player.yaw - previousYaw));
  }

  return {
    timeTo90PercentSpeed: hasReached90 ? timeTo90PercentSpeed : 1,
    distanceInFirstSecond,
    turnDegreesPerSecond: (turnRadians / 2) * (180 / Math.PI),
  };
}

function targetDamage(match: Match) {
  return match.fx.reduce((sum, event) => sum + (event.k === "hit" ? event.dmg : 0), 0);
}

function abilityTrial(shipId: ShipId) {
  const ship = SHIPS[shipId];
  const targetShip: ShipId = ship.faction === "accord" ? "duskbreaker" : "mandjet";
  const { match, player, opponent } = createDuel(shipId, targetShip, 0xA817, 12);
  match.relays.forEach((relay) => {
    relay.x = 500;
    relay.z = 500;
  });
  match.rocks = [];
  player.x = 0;
  player.z = 30;
  player.yaw = 0;
  player.guard = 0;
  opponent.x = 0;
  opponent.yaw = 0;
  opponent.guard = 0;
  opponent.ai = false;
  opponent.hullMax = 100_000;
  opponent.hull = 100_000;
  opponent.shieldMax = 100_000;
  opponent.shield = 100_000;
  match.lockId = opponent.id;

  const ramTest = shipId === "shakuna" || shipId === "glide";
  opponent.z = player.z - 12;
  if (shipId === "sentinel") player.shield = player.shieldMax * 0.5;

  const tick = (input: StepInput) => {
    opponent.human = IDLE;
    match.fx.length = 0;
    step(match, input, 1 / 60);
    return targetDamage(match);
  };

  const shieldBefore = player.shield;
  const abilityHit = tick({ ...IDLE, ult: true });
  const cloakAtActivation = player.cloak;
  const boostAtActivation = player.boost;
  const untargetableAtActivation = player.untargetable;
  const boostDamageAtActivation = player.boostDmg;
  const damageMultiplierAtActivation = player.dmgMul;
  const damageMultiplierTimeAtActivation = player.dmgMulT;
  const rootAtActivation = opponent.root;
  const jamAtActivation = opponent.jam;
  const guardAtActivation = player.guard;
  let ramHit = 0;
  if (ramTest) {
    opponent.x = player.x;
    opponent.z = player.z - player.radius - opponent.radius - 0.1;
    ramHit = tick(IDLE);
  }
  let firstShotDamage = 0;
  if (shipId === "sundara" || shipId === "duskbreaker") {
    for (let i = 0; i < 120 && firstShotDamage === 0; i += 1) {
      firstShotDamage = tick({ ...IDLE, fire: true });
    }
  }

  let effect: string;
  switch (shipId) {
    case "mandjet":
      effect = `Solar Flare: ${abilityHit.toFixed(1)} measured forward-cone damage at 12 m`;
      break;
    case "shakuna":
      effect = `Wing Dive: ${ramHit.toFixed(1)} measured ram damage; ${boostDamageAtActivation.toFixed(0)} ram power; ${boostAtActivation.toFixed(2)} s boost`;
      break;
    case "sundara":
      effect = `Vortex Camouflage: ${cloakAtActivation.toFixed(2)} s cloak; ${firstShotDamage.toFixed(1)} measured next-shot damage`;
      break;
    case "tripura":
      effect = `Trinity Shift: ${rootAtActivation.toFixed(2)} s thrust root at 12 m`;
      break;
    case "duskbreaker":
      effect = `Quantum Lock: ${damageMultiplierAtActivation.toFixed(2)}x damage for ${damageMultiplierTimeAtActivation.toFixed(1)} s; ${firstShotDamage.toFixed(1)} measured first-shot damage`;
      break;
    case "sentinel":
      effect = `Proximity Ward: restored ${(player.shield - shieldBefore).toFixed(1)} shield; ${guardAtActivation.toFixed(2)} s guard`;
      break;
    case "splitter":
      effect = `Ring Split: ${jamAtActivation.toFixed(2)} s target jam`;
      break;
    case "glide":
      effect = `Skip Reentry: ${ramHit.toFixed(1)} measured ram damage; ${untargetableAtActivation.toFixed(2)} s untargetable; ${boostAtActivation.toFixed(2)} s boost`;
      break;
  }

  return { effect, cooldownSeconds: ship.ultCd };
}

function emptyRow(shipId: ShipId): MutableRow {
  return {
    shipId,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    damageDealt: 0,
    damageReceived: 0,
    aliveSeconds: 0,
    totalSeconds: 0,
    firstDeathSeconds: 0,
    distance: 0,
    turnRadians: 0,
    opponentRoles: Object.fromEntries(ROLES.map((role) => [role, { matches: 0, wins: 0, draws: 0, losses: 0 }])),
  };
}

function addResult(
  row: MutableRow,
  role: string,
  result: DuelResult,
  side: 0 | 1,
  won: boolean,
  drawn: boolean,
) {
  row.matches += 1;
  row.wins += Number(won);
  row.draws += Number(drawn);
  row.losses += Number(!won && !drawn);
  row.damageDealt += result.damageDealt[side];
  row.damageReceived += result.damageReceived[side];
  row.aliveSeconds += result.aliveSeconds[side];
  row.totalSeconds += result.duration;
  row.firstDeathSeconds += result.firstDeathSeconds[side];
  row.distance += result.distance[side];
  row.turnRadians += result.turnRadians[side];
  const roleRow = row.opponentRoles[role];
  roleRow.matches += 1;
  roleRow.wins += Number(won);
  roleRow.draws += Number(drawn);
  roleRow.losses += Number(!won && !drawn);
}

export function runShipCertification(options: { seeds?: number; durationSeconds?: number } = {}): ShipCertificationRow[] {
  const seeds = Math.max(1, Math.floor(options.seeds ?? 5));
  const durationSeconds = Math.max(10, options.durationSeconds ?? 360);
  const mutableRows = new Map<ShipId, MutableRow>(
    (Object.keys(SHIPS) as ShipId[]).map((shipId) => [shipId, emptyRow(shipId)]),
  );
  const accordShips = (Object.keys(SHIPS) as ShipId[]).filter((id) => SHIPS[id].faction === "accord");
  const ussfShips = (Object.keys(SHIPS) as ShipId[]).filter((id) => SHIPS[id].faction === "ussf");

  for (const accordShip of accordShips) {
    for (const ussfShip of ussfShips) {
      for (let sample = 0; sample < seeds; sample += 1) {
        const seed = 0x5100 + sample * 97 + accordShips.indexOf(accordShip) * 17 + ussfShips.indexOf(ussfShip) * 31;
        const directions: Array<[ShipId, ShipId]> = [
          [accordShip, ussfShip],
          [ussfShip, accordShip],
        ];
        for (const [playerShip, opponentShip] of directions) {
          const result = runDuel(playerShip, opponentShip, seed, durationSeconds);
          const playerWon = result.winner === "you";
          const opponentWon = result.winner === "foe";
          const drawn = result.winner === "draw";
          addResult(
            mutableRows.get(playerShip)!,
            SHIPS[opponentShip].role,
            result,
            0,
            playerWon,
            drawn,
          );
          addResult(
            mutableRows.get(opponentShip)!,
            SHIPS[playerShip].role,
            result,
            1,
            opponentWon,
            drawn,
          );
        }
      }
    }
  }

  return (Object.keys(SHIPS) as ShipId[]).map((shipId) => {
    const ship = SHIPS[shipId];
    const row = mutableRows.get(shipId)!;
    const movement = movementProbe(shipId);
    const ability = abilityTrial(shipId);
    const matches = Math.max(1, row.matches);
    const aliveSeconds = Math.max(1, row.aliveSeconds);
    return {
      shipId,
      name: ship.name,
      faction: ship.faction,
      role: ship.role,
      matches: row.matches,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      winRate: (row.wins + row.draws * 0.5) / matches,
      avgDamageDealt: row.damageDealt / matches,
      avgDamageReceived: row.damageReceived / matches,
      avgFirstLifeSeconds: row.firstDeathSeconds / matches,
      alivePercent: row.aliveSeconds / Math.max(1, row.totalSeconds),
      firstSecondDistance: movement.distanceInFirstSecond,
      distancePerAliveMinute: (row.distance / aliveSeconds) * 60,
      turnDegreesPerSecond: (row.turnRadians / aliveSeconds) * (180 / Math.PI),
      timeTo90PercentSpeed: movement.timeTo90PercentSpeed,
      handlingTurnDegreesPerSecond: movement.turnDegreesPerSecond,
      abilityEffect: `${ability.effect}; ${ability.cooldownSeconds}s cooldown`,
      opponentRoles: row.opponentRoles,
    };
  });
}

function wdl(record: RoleRecord) {
  if (record.matches === 0) return "—";
  const rate = ((record.wins + record.draws * 0.5) / record.matches) * 100;
  return `${record.wins}-${record.draws}-${record.losses} (${rate.toFixed(0)}%)`;
}

export function formatShipCertification(rows: ShipCertificationRow[], seeds = 5, durationSeconds = 360) {
  const matchesPerShip = rows[0]?.matches ?? 0;
  const table = rows.map((row) => {
    const survival = `${row.avgFirstLifeSeconds.toFixed(0)} s / ${(row.alivePercent * 100).toFixed(0)}%`;
    const movement = `${row.timeTo90PercentSpeed.toFixed(2)} s to 90%; ${row.firstSecondDistance.toFixed(1)} m in 1 s; ${row.handlingTurnDegreesPerSecond.toFixed(1)}°/s`;
    const damage = `${row.avgDamageDealt.toFixed(1)} / ${row.avgDamageReceived.toFixed(1)}`;
    return `| ${row.name} (${row.role}) | ${row.wins}-${row.draws}-${row.losses} | ${(row.winRate * 100).toFixed(1)}% | ${damage} | ${survival} | ${movement} | ${row.distancePerAliveMinute.toFixed(0)} m/min | ${row.turnDegreesPerSecond.toFixed(1)}°/s | ${row.abilityEffect} |`;
  });
  const roleTable = rows.map((row) => {
    const cells = ROLES.map((role) => wdl(row.opponentRoles[role]));
    return `| ${row.name} | ${cells.join(" | ")} |`;
  });
  const flagged = rows.filter((row) => row.winRate < 0.4 || row.winRate > 0.6);
  const sameRoleDamageFlags: string[] = [];
  const roleGroups = new Map<string, ShipCertificationRow[]>();
  for (const row of rows) {
    const group = roleGroups.get(row.role) ?? [];
    group.push(row);
    roleGroups.set(row.role, group);
  }
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  for (const [role, group] of roleGroups) {
    if (group.length < 2) continue;
    const dealtMedian = median(group.map((row) => row.avgDamageDealt));
    const receivedMedian = median(group.map((row) => row.avgDamageReceived));
    for (const row of group) {
      if (dealtMedian > 0 && Math.abs(row.avgDamageDealt - dealtMedian) / dealtMedian > 0.25) {
        sameRoleDamageFlags.push(`${row.name} dealt damage vs ${role} median`);
      }
      if (receivedMedian > 0 && Math.abs(row.avgDamageReceived - receivedMedian) / receivedMedian > 0.25) {
        sameRoleDamageFlags.push(`${row.name} received damage vs ${role} median`);
      }
    }
  }
  const roleFlags = rows.flatMap((row) =>
    ROLES.filter((role) => {
      const record = row.opponentRoles[role];
      return record.matches >= 10 && (record.wins + record.draws * 0.5) / record.matches < 0.35
        || record.matches >= 10 && (record.wins + record.draws * 0.5) / record.matches > 0.65;
    }).map((role) => `${row.name} vs ${role}`),
  );

  return [
    "# WAR FOR MARS — Eight-Ship Certification",
    "",
    `**Run:** ${new Date().toISOString().slice(0, 10)} · **Seeds per pairing:** ${seeds} · **Duration cap:** ${durationSeconds}s · **Matches per ship:** ${matchesPerShip}`,
    "**Status:** Repeatable simulation certification; not a substitute for human playtesting.",
    "",
    "## Method",
    "",
    `- Every Accord ship was tested against every USSF ship: 16 cross-faction pairs, each mirrored by swapping which ship starts in the player seat, for ${seeds} fixed seeds per pair.`,
    "- Each duel used one standardized scripted pilot per side: lead aiming, the same fire/turn policy, zero refit, no teammates, no map rocks, and class-specific ability triggers at fixed range/health conditions.",
    "- At five seeds this yields 160 six-minute-cap duels and 40 appearances per ship. Same seed and matchup are used in both seat orientations.",
    "- Damage is summed from landed hit events; first-life survival is censored at match end for pilots that survive; alive percentage includes respawn downtime; movement and turn rate are also measured in isolated throttle/turn probes.",
    "- Ability effects are measured in a separate stationary-target drill so support/control abilities are not misrepresented as direct damage.",
    "",
    "## Results",
    "",
    "| Ship / role | W-D-L | Score rate* | Avg damage dealt / received | First life / time alive | 0–90% speed / turn probe | Battle distance | Battle turn | Ability drill |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...table,
    "",
    "*Score rate counts a draw as half a win. Damage is per duel. First-life survival is capped at the match duration; alive percentage accounts for respawns.",
    "",
    "## Results by opposing role",
    "",
    "| Ship | Vanguard | Hunter | Striker | Support | Raider |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...roleTable,
    "",
    "Cells show W-D-L (score rate). A dash means that role was not represented on the opposing faction.",
    "",
    "## Balancing process and review flags",
    "",
    "- Keep each ship's written role and ability identity intact; change one stat or one ability parameter per balance iteration.",
    "- Review a ship when its overall score rate is below 40% or above 60% after at least 40 matches, or a role matchup is below 35% or above 65% with at least 10 samples.",
    "- Also review a ship when damage dealt or received is more than 25% from the median of the same-role ships. Do not auto-nerf from a small sample.",
    "- Any flagged ship must be rerun with a new seed cohort, then checked in human play before the change is accepted.",
    `- Overall flags: ${flagged.length ? flagged.map((row) => `${row.name} ${(row.winRate * 100).toFixed(0)}%`).join(", ") : "none"}.`,
    `- Role flags: ${roleFlags.length ? roleFlags.join(", ") : "none"}.`,
    `- Same-role damage flags: ${sameRoleDamageFlags.length ? sameRoleDamageFlags.join(", ") : "none"}.`,
    "",
    "## Limits",
    "",
    "- This is a deterministic scripted-pilot benchmark, not a human win rate or proof that every ship feels equally fun.",
    "- The ability drill measures one controlled effect per ability; it does not measure ability value over a full match.",
    "- Phone touch controls, Android Chrome/iOS Safari behavior, frame rate, memory, and thermal performance require the separate device certification.",
    "",
  ].join("\n");
}

if (process.argv[1]?.endsWith("/ship-certification.ts")) {
  const rows = runShipCertification();
  process.stdout.write(formatShipCertification(rows));
}
