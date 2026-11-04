import {
  IRON_ECLIPSE_SUBSYSTEMS, IRON_ECLIPSE_WING,
  type IronEclipseOrder, type IronEclipseSnapshot, type IronEclipseSubsystemId,
} from "./sector-missions";
import type { FlightSector, Vector3 } from "./flight-sector";

type WingState = IronEclipseSnapshot["wing"][number];
type SubsystemState = IronEclipseSnapshot["subsystems"][number];

export type IronEclipseState = {
  view: IronEclipseSnapshot;
  pointDefenseCooldown: number;
  pointDefenseTargetCursor: number;
  attackProgress: Map<string, number>;
};

const copy = (v: Vector3): Vector3 => ({ x: v.x, y: v.y, z: v.z });
const add = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const length = (v: Vector3): number => Math.hypot(v.x, v.y, v.z);
const distance = (a: Vector3, b: Vector3): number => length(sub(a, b));
const scale = (v: Vector3, n: number): Vector3 => ({ x: v.x * n, y: v.y * n, z: v.z * n });

function subsystem(state: IronEclipseState, id: IronEclipseSubsystemId | null): SubsystemState | undefined {
  return state.view.subsystems.find(item => item.id === id);
}

function fallbackTarget(state: IronEclipseState): void {
  if (state.view.phase === "extract" || state.view.phase === "complete" || state.view.phase === "failed") {
    state.view.target = null;
    return;
  }
  const available = (id: IronEclipseSubsystemId) => {
    const item = subsystem(state, id);
    return item && !item.disabled;
  };
  if (available(state.view.target ?? "point-defense")) return;
  state.view.target = available("point-defense") ? "point-defense"
    : available("reactor") ? "reactor"
      : available("shield-array") ? "shield-array" : null;
}

export function createIronEclipseState(sector: FlightSector): IronEclipseState {
  const capitalPosition = copy(sector.drone ?? { x: 0, y: 70, z: -460 });
  const start = copy(sector.relay);
  return {
    view: {
      phase: "engage",
      target: "point-defense",
      order: "regroup",
      capitalPosition,
      subsystems: IRON_ECLIPSE_SUBSYSTEMS.map(item => ({
        id: item.id, label: item.label,
        position: add(capitalPosition, item.offset),
        hull: item.maxHull, maxHull: item.maxHull, disabled: false,
      })),
      wing: IRON_ECLIPSE_WING.map(item => ({
        id: item.id, shipId: item.shipId,
        position: add(start, item.offset), hull: 100, maxHull: 100, connected: true,
      })),
      objectives: { primary: "pending", shieldArray: "pending", wingSurvival: "pending" },
    },
    pointDefenseCooldown: 3.5,
    pointDefenseTargetCursor: 0,
    attackProgress: new Map(),
  };
}

export function ironEclipseSnapshot(state: IronEclipseState): IronEclipseSnapshot {
  return {
    ...state.view,
    capitalPosition: copy(state.view.capitalPosition),
    subsystems: state.view.subsystems.map(item => ({ ...item, position: copy(item.position) })),
    wing: state.view.wing.map(item => ({ ...item, position: copy(item.position) })),
    objectives: { ...state.view.objectives },
  };
}

export function ironEclipseTarget(state: IronEclipseState): SubsystemState | undefined {
  fallbackTarget(state);
  return subsystem(state, state.view.target);
}

/** The reactor is server-locked until the point-defense network is destroyed. */
export function setIronEclipseTarget(state: IronEclipseState, id: IronEclipseSubsystemId): boolean {
  const selected = subsystem(state, id);
  if (!selected || selected.disabled) return false;
  if (id === "reactor" && !subsystem(state, "point-defense")?.disabled) return false;
  state.view.target = id;
  return true;
}

export function setIronEclipseOrder(state: IronEclipseState, order: IronEclipseOrder): void {
  state.view.order = order;
}

export function markIronEclipseCapitalEngaged(state: IronEclipseState): void {
  if (state.view.phase === "engage") state.view.phase = "capital";
}

export function completeIronEclipse(state: IronEclipseState, succeeded: boolean): void {
  state.view.phase = succeeded ? "complete" : "failed";
  state.view.target = null;
  state.view.objectives.primary = succeeded ? "complete" : "missed";
  state.view.objectives.shieldArray = state.view.objectives.shieldArray === "complete"
    ? "complete" : "missed";
  state.view.objectives.wingSurvival = state.view.wing.some(unit => unit.hull > 0) && succeeded
    ? "complete" : "missed";
}

/** Damage is accepted only against the current server-selected subsystem. */
export function damageIronEclipseTarget(state: IronEclipseState, amount: number): number {
  const target = ironEclipseTarget(state);
  if (!target || !Number.isFinite(amount) || amount <= 0) return 0;
  if (target.id === "reactor" && !subsystem(state, "point-defense")?.disabled) return 0;
  const shield = subsystem(state, "shield-array");
  const multiplier = target.id === "reactor" && shield && !shield.disabled ? 0.2 : 1;
  const applied = Math.min(target.hull, amount * multiplier);
  target.hull = Math.max(0, target.hull - applied);
  if (target.hull === 0) {
    target.disabled = true;
    if (target.id === "shield-array") state.view.objectives.shieldArray = "complete";
    if (target.id === "reactor") {
      state.view.phase = "extract";
      state.view.target = null;
    }
    fallbackTarget(state);
  }
  return applied;
}

function moveTowards(unit: WingState, goal: Vector3, dt: number): void {
  const delta = sub(goal, unit.position);
  const distanceToGoal = length(delta);
  if (distanceToGoal < 0.001) return;
  unit.position = add(unit.position, scale(delta, Math.min(1, 42 * dt / distanceToGoal)));
}

function targetGoal(target: SubsystemState): Vector3 {
  return add(target.position, { x: 0, y: 0, z: 66 });
}

/** Deterministic server-side wing movement, weapons, capital fire and regroup repair. */
export function advanceIronEclipse(
  state: IronEclipseState,
  dt: number,
  hostPosition: Vector3,
  defendPosition: Vector3,
): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const step = Math.min(dt, 1 / 20);
  const formation = [
    { x: -18, y: 6, z: 26 },
    { x: 0, y: 10, z: 38 },
    { x: 18, y: 6, z: 26 },
  ];
  const target = ironEclipseTarget(state);
  for (const [index, unit] of state.view.wing.entries()) {
    if (unit.hull <= 0) { unit.connected = false; continue; }
    const offset = formation[index]!;
    let goal: Vector3;
    if (state.view.order === "attack" && target) goal = targetGoal(target);
    else if (state.view.order === "defend") goal = add(defendPosition, offset);
    else goal = add(hostPosition, offset);
    moveTowards(unit, goal, step);
    if (state.view.order === "regroup") unit.hull = Math.min(unit.maxHull, unit.hull + 5 * step);
    if (state.view.phase === "capital" && state.view.order === "attack" && target &&
        state.view.target === target.id &&
        distance(unit.position, target.position) <= 170) {
      const progress = (state.attackProgress.get(unit.id) ?? 0) + step;
      const damage = Math.floor(progress * 8);
      if (damage > 0) {
        damageIronEclipseTarget(state, damage);
        state.attackProgress.set(unit.id, progress - damage / 8);
      } else state.attackProgress.set(unit.id, progress);
    }
  }
  if (state.view.phase === "capital" && !subsystem(state, "point-defense")?.disabled) {
    state.pointDefenseCooldown -= step;
    if (state.pointDefenseCooldown <= 0) {
      const alive = state.view.wing.filter(unit => unit.hull > 0);
      if (alive.length) {
        const targetUnit = alive[state.pointDefenseTargetCursor++ % alive.length]!;
        targetUnit.hull = Math.max(0, targetUnit.hull - 12);
        targetUnit.connected = targetUnit.hull > 0;
      }
      state.pointDefenseCooldown = 3.5;
    }
  }
}

/** Protect nearby pilots under defend/escort orders; the wing absorbs a share. */
export function absorbWingDamage(
  state: IronEclipseState,
  pilotPosition: Vector3,
  defendPosition: Vector3,
  incoming: number,
): number {
  if (!Number.isFinite(incoming) || incoming <= 0) return 0;
  let share = 0;
  if (state.view.order === "defend" && distance(pilotPosition, defendPosition) <= 180) share = 0.35;
  if (state.view.order === "escort") {
    const nearby = state.view.wing.some(unit => unit.hull > 0 && distance(unit.position, pilotPosition) <= 100);
    if (nearby) share = 0.3;
  }
  if (!share) return 0;
  const damage = incoming * share;
  const unit = state.view.wing.filter(candidate => candidate.hull > 0)
    .sort((a, b) => a.hull - b.hull)[0];
  if (unit) {
    unit.hull = Math.max(0, unit.hull - damage * 0.75);
    unit.connected = unit.hull > 0;
  }
  return damage;
}
