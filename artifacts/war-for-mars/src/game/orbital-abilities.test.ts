import assert from "node:assert/strict";
import test from "node:test";
import { activateOrbitalAbility, advanceOrbitalAbility, ORBITAL_ABILITY_COST, processOrbitalAbility } from "./orbital-abilities";
import { launchMissile, updateAcquisition } from "./orbital-weapons";
import { createMatch } from "./sim";
import { prepareOrbital } from "./orbital-sim";
import { SHIPS, type ShipId } from "./ships";

function matchFor(ship: ShipId) {
  const match = prepareOrbital(createMatch(ship, SHIPS[ship].faction, 0, "practice", {
    foeCount: 3,
    allyCount: 1,
    seed: 0xA817,
    orbitalTraining: true,
  }));
  match.rocks = [];
  const targets = match.enemies;
  targets.forEach((target, index) => {
    target.x = index * 2;
    target.z = match.player.z - 12 - index * 4;
    target.space!.y = 0;
    target.guard = 0;
  });
  return match;
}

const hurt = (_match: ReturnType<typeof matchFor>, target: ReturnType<typeof matchFor>["player"], damage: number) => {
  const absorbed = Math.min(target.shield, damage);
  target.shield -= absorbed;
  target.hull -= damage - absorbed;
  return true;
};

test("every original and specialist ship activates its distinct, energy-bounded Orbital ability", () => {
  const ids = Object.keys(SHIPS) as ShipId[];
  assert.equal(ids.length, 16);
  for (const id of ids) {
    const match = matchFor(id);
    const pilot = match.player;
    const initialEnergy = pilot.space!.energy;
    assert.equal(activateOrbitalAbility(match, pilot, { hurt }), true, `${id} ability should activate`);
    assert.ok(pilot.ultCd > 0, `${id} should start a cooldown`);
    assert.equal(pilot.space!.energy, initialEnergy - ORBITAL_ABILITY_COST[SHIPS[id].ability]);
    assert.ok(match.fx.length > 0, `${id} should provide visible activation feedback`);
  }
});

test("original Orbital abilities change spatial combat state, including thrust-only disruption", () => {
  const solar = matchFor("mandjet");
  const solarTarget = solar.enemies[0]!;
  const targetShield = solarTarget.shield;
  activateOrbitalAbility(solar, solar.player, { hurt });
  assert.ok(solarTarget.shield < targetShield, "Solar Flare damages targets in its forward cone");

  const dive = matchFor("shakuna");
  activateOrbitalAbility(dive, dive.player, { hurt });
  assert.ok(dive.player.boost > 0 && dive.player.boostDmg > 0);

  const cloak = matchFor("sundara");
  activateOrbitalAbility(cloak, cloak.player, { hurt });
  assert.ok(cloak.player.cloak > 0 && cloak.player.nextCrit);

  const shift = matchFor("tripura");
  activateOrbitalAbility(shift, shift.player, { hurt });
  assert.ok((shift.enemies[0]!.thrustMuted ?? 0) > 0);
  assert.equal(shift.enemies[0]!.root, 0, "Trinity Shift does not freeze guns or steering");

  const lock = matchFor("duskbreaker");
  activateOrbitalAbility(lock, lock.player, { hurt });
  assert.equal(lock.player.lockTargetId, lock.enemies[0]!.id);
  assert.ok(lock.player.dmgMulT > 0);

  const ward = matchFor("sentinel");
  ward.player.shield = 20;
  activateOrbitalAbility(ward, ward.player, { hurt });
  assert.ok(ward.player.shield > 20 && ward.player.shield < ward.player.shieldMax);

  const split = matchFor("splitter");
  split.enemies[0]!.lockTargetId = split.player.id;
  split.enemies[0]!.space!.lockTargetId = split.player.id;
  split.enemies[0]!.space!.lockProgress = 1;
  activateOrbitalAbility(split, split.player, { hurt });
  assert.equal(split.enemies[0]!.lockTargetId, null);
  assert.equal(split.enemies[0]!.space!.lockProgress, 0);

  const reentry = matchFor("glide");
  activateOrbitalAbility(reentry, reentry.player, { hurt });
  assert.ok(reentry.player.untargetable > 0 && reentry.player.boost > 0);
});

test("specialist Orbital abilities affect flight, fire, missiles, support, and electronic warfare", () => {
  const vector = matchFor("wasp");
  activateOrbitalAbility(vector, vector.player, { hurt });
  assert.ok((vector.player.abilityState?.active ?? 0) > 0);

  const adaptive = matchFor("valiant");
  activateOrbitalAbility(adaptive, adaptive.player, { hurt });
  assert.equal(adaptive.player.abilityState?.shotsRemaining, 7);

  const aegis = matchFor("aegis");
  activateOrbitalAbility(aegis, aegis.player, { hurt });
  const ally = aegis.allies[0]!;
  aegis.bullets.push({
    x: ally.x, y: ally.space!.y, z: ally.z + 4, vx: 0, vy: 0, vz: -20,
    life: 2, dmg: 12, r: 0.5, homeId: ally.id, missile: true, faction: "accord", own: false,
  });
  processOrbitalAbility(aegis, aegis.player);
  assert.equal(aegis.bullets.length, 0, "Intercept Grid removes a threat to a nearby ally");
  assert.equal(aegis.player.abilityState?.interceptsRemaining, 2);

  const siege = matchFor("bastion");
  activateOrbitalAbility(siege, siege.player, { hurt });
  assert.ok((siege.player.abilityState?.active ?? 0) > 0);

  const veil = matchFor("apep");
  activateOrbitalAbility(veil, veil.player, { hurt });
  assert.ok(veil.player.cloak > 0);
  assert.ok(veil.enemies.some((enemy) => enemy.jam > 0));

  const cataclysm = matchFor("sekhmet");
  activateOrbitalAbility(cataclysm, cataclysm.player, { hurt });
  assert.ok(cataclysm.player.abilityState!.charge > 0);
  cataclysm.player.abilityState!.charge = 0;
  advanceOrbitalAbility(cataclysm, cataclysm.player);
  assert.ok(cataclysm.bullets.some((bullet) => bullet.own && bullet.dmg === 42 && bullet.r > 0.7));

  const swarm = matchFor("garuda");
  activateOrbitalAbility(swarm, swarm.player, { hurt });
  assert.equal(swarm.bullets.filter((bullet) => bullet.missile && bullet.own).length, 3);
  assert.equal(new Set(swarm.bullets.map((bullet) => bullet.homeId)).size, 3);

  const thunder = matchFor("vajra");
  const energyBefore = thunder.enemies[0]!.space!.energy;
  activateOrbitalAbility(thunder, thunder.player, { hurt });
  assert.ok(thunder.enemies[0]!.jam > 0);
  assert.ok(thunder.enemies[0]!.space!.energy < energyBefore);
});

test("Orbital missile fit changes both rack capacity and guided missile damage", () => {
  const match = matchFor("wasp");
  assert.equal(match.player.space!.ammo, SHIPS.wasp.missileAmmo);
  const target = match.enemies[0]!;
  match.player.lockTargetId = target.id;
  match.player.space!.lockTargetId = target.id;
  match.player.space!.missileCd = 0;
  for (let i = 0; i < 90; i++) updateAcquisition(match, match.player, 1 / 60);
  assert.equal(launchMissile(match, match.player), true);
  assert.equal(match.player.space!.ammo, 9);
  assert.equal(match.bullets[0]!.dmg, SHIPS.wasp.missileDamage);
});
