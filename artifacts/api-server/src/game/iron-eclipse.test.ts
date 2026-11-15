import assert from "node:assert/strict";
import test from "node:test";
import {
  absorbWingDamage, advanceIronEclipse, completeIronEclipse, createIronEclipseState,
  damageIronEclipseTarget, ironEclipseSnapshot, markIronEclipseCapitalEngaged,
  setIronEclipseOrder, setIronEclipseTarget,
} from "./iron-eclipse";
import { sectorMission } from "./sector-missions";

const mission = sectorMission("iron-eclipse")!;

test("Iron Eclipse starts with one capital, three subsystems, and a three-ship server wing", () => {
  const state = createIronEclipseState(mission.sector);
  const view = ironEclipseSnapshot(state);
  assert.equal(view.phase, "engage");
  assert.equal(view.subsystems.length, 3);
  assert.deepEqual(view.subsystems.map(item => item.id), ["point-defense", "shield-array", "reactor"]);
  assert.equal(view.wing.length, 3);
  assert.ok(view.wing.every(unit => unit.connected && unit.hull === unit.maxHull));
  assert.equal(view.objectives.primary, "pending");
});

test("reactor target is unavailable until point defense is disabled; shield array absorbs reactor damage", () => {
  const state = createIronEclipseState(mission.sector);
  assert.equal(setIronEclipseTarget(state, "reactor"), false);
  damageIronEclipseTarget(state, 120);
  assert.equal(state.view.subsystems.find(item => item.id === "point-defense")?.disabled, true);
  assert.equal(setIronEclipseTarget(state, "reactor"), true);
  assert.equal(damageIronEclipseTarget(state, 100), 20);
  assert.equal(state.view.subsystems.find(item => item.id === "reactor")?.hull, 160);
  assert.equal(setIronEclipseTarget(state, "shield-array"), true);
  damageIronEclipseTarget(state, 140);
  assert.equal(state.view.objectives.shieldArray, "complete");
  assert.equal(state.view.target, "reactor");
  assert.equal(damageIronEclipseTarget(state, 100), 100);
  assert.equal(state.view.subsystems.find(item => item.id === "reactor")?.hull, 60);
  assert.equal(damageIronEclipseTarget(state, 60), 60);
  assert.equal(state.view.phase, "extract");
  assert.equal(state.view.objectives.primary, "pending");
  assert.equal(state.view.target, null);
});

test("attack order moves the AI wing into range and applies server-side subsystem damage", () => {
  const state = createIronEclipseState(mission.sector);
  markIronEclipseCapitalEngaged(state);
  setIronEclipseOrder(state, "attack");
  for (let i = 0; i < 3000; i++) advanceIronEclipse(state, 1 / 60, mission.sector.relay, mission.sector.relay);
  assert.equal(state.view.subsystems.find(item => item.id === "point-defense")?.disabled, true);
  assert.ok(state.view.subsystems.find(item => item.id === "reactor")!.hull < 180);
  assert.ok(state.view.wing.some(unit => unit.hull > 0));
});

test("defend and escort reduce nearby pilot damage while regroup repairs wing units", () => {
  const state = createIronEclipseState(mission.sector);
  const ally = state.view.wing[0]!;
  ally.hull = 50;
  setIronEclipseOrder(state, "defend");
  const defended = absorbWingDamage(state, mission.sector.relay, mission.sector.relay, 20);
  assert.equal(defended, 7);
  assert.ok(ally.hull < 50);
  setIronEclipseOrder(state, "escort");
  const escorted = absorbWingDamage(state, ally.position, mission.sector.relay, 20);
  assert.equal(escorted, 6);
  const beforeRepair = ally.hull;
  setIronEclipseOrder(state, "regroup");
  for (let i = 0; i < 60; i++) advanceIronEclipse(state, 1 / 60, mission.sector.relay, mission.sector.relay);
  assert.ok(ally.hull > beforeRepair);
});

test("successful extraction resolves primary and survival objectives; failed operation never marks success", () => {
  const success = createIronEclipseState(mission.sector);
  damageIronEclipseTarget(success, 120);
  setIronEclipseTarget(success, "shield-array");
  damageIronEclipseTarget(success, 140);
  setIronEclipseTarget(success, "reactor");
  damageIronEclipseTarget(success, 180);
  assert.equal(success.view.phase, "extract");
  assert.equal(success.view.objectives.primary, "pending");
  completeIronEclipse(success, true);
  assert.equal(success.view.phase, "complete");
  assert.equal(success.view.objectives.primary, "complete");
  assert.equal(success.view.objectives.wingSurvival, "complete");

  const failed = createIronEclipseState(mission.sector);
  completeIronEclipse(failed, false);
  assert.equal(failed.view.phase, "failed");
  assert.equal(failed.view.objectives.primary, "missed");
  assert.equal(failed.view.objectives.shieldArray, "missed");
  assert.equal(failed.view.objectives.wingSurvival, "missed");
});
