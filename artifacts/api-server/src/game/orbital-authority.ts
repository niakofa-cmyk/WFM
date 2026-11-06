import {
  absorbArmor, acquireTarget, deployCountermeasure, guideMissile, IDLE_ORBITAL, integrateSpatialFlight, newFlight,
  MISSILE_CATALOG, ORBITAL_DT, ORBITAL_RULES_VERSION, parseOrbitalInput, PRIMARY_WEAPON_CATALOG,
  PROJECTILE_LIMIT, segmentHit, spawnMissileVolley, spawnPrimaryVolley,
  type OrbitalFlight, type OrbitalInput, type Rock, type SpatialBullet,
} from "@workspace/orbital-sim";
import { createMatch, type Craft } from "./sim";
import { SHIPS } from "./ships";

type Pilot = Craft & { space: OrbitalFlight; slotId: number; lastSeq: number };
type Projectile = SpatialBullet & { owner: number; faction: Pilot["faction"] };
type Event = {
  type: "hit" | "destroyed" | "missile" | "countermeasure";
  source: number; target: number; damage?: number; decoyed?: number; disrupted?: number;
};
const QUEUE_LIMIT = 8;
const MAX_SEQUENCE_ADVANCE = 256;

// Not registered with the existing socket service. Caller must bind an authenticated seat before integration.
export function createOrbitalAuthority(seed = 1938, obstacles: readonly Rock[] = []) {
  const baseline = createMatch("duskbreaker", "ussf", 0, "strike", { seed, allyCount: 4, foeCount: 5 });
  const rocks = obstacles.map((rock) => ({ ...rock }));
  const pilots: Pilot[] = [baseline.player, ...baseline.allies, ...baseline.enemies].map((craft, slotId) => {
    const offset = slotId % 5;
    const x = offset === 0 ? 0 : (offset % 2 ? -1 : 1) * Math.ceil(offset / 2) * 18;
    const yaw = slotId < 5 ? 0 : Math.PI;
    return { ...craft, slotId, x, z: slotId < 5 ? 28 : -4, yaw, pitch: 0, speed: 0,
      ai: false, human: null, guard: 0, lastSeq: 0, lockTargetId: null,
      space: { ...newFlight(yaw), ammo: SHIPS[craft.ship].missileAmmo, countermeasureCd: 0 } };
  });
  const queues: OrbitalInput[][] = pilots.map(() => []);
  let bullets: Projectile[] = [];
  let events: Event[] = [];
  let tick = 0;
  let over: null | "ussf" | "accord" | "draw" = null;

  function snapshot() {
    return structuredClone({ version: ORBITAL_RULES_VERSION, tick, time: tick * ORBITAL_DT, over, pilots, bullets, events, rocks });
  }
  function applyDamage(target: Pilot, bullet: Projectile) {
    const shield = Math.min(target.shield, bullet.dmg);
    target.shield -= shield;
    target.hull = Math.max(0, target.hull - absorbArmor(target.space, bullet.dmg - shield));
    target.hurtT = 2;
    target.cloak = 0;
    events.push({ type: "hit", source: bullet.owner, target: target.id, damage: bullet.dmg });
    if (target.hull <= 0) {
      target.alive = false;
      target.space.lockProgress = 0;
      queues[target.slotId] = [];
      events.push({ type: "destroyed", source: bullet.owner, target: target.id });
    }
  }
  return {
    snapshot,
    input(slotId: number, packet: unknown): { ok: true } | { ok: false; reason: string } {
      const pilot = pilots[slotId];
      if (!Number.isInteger(slotId) || !pilot) return { ok: false, reason: "seat" };
      if (over || !pilot.alive) return { ok: false, reason: "inactive" };
      const parsed = parseOrbitalInput(packet);
      if (!parsed.ok) return parsed;
      const input = parsed.input;
      const queue = queues[slotId];
      const last = queue.length ? queue[queue.length - 1].seq : pilot.lastSeq;
      if (input.seq <= last || input.seq - last > MAX_SEQUENCE_ADVANCE) return { ok: false, reason: "sequence" };
      if (input.targetId !== null && !pilots.some((c) => c.id === input.targetId && c.faction !== pilot.faction && c.alive)) return { ok: false, reason: "target" };
      if (queue.length >= QUEUE_LIMIT) return { ok: false, reason: "queue_full" };
      queue.push(input);
      return { ok: true };
    },
    step() {
      if (over) return snapshot();
      tick++;
      events = [];
      // All movement completes before weapon acquisition, independent of seat order.
      const inputs = pilots.map((pilot) => {
        const input = queues[pilot.slotId].shift();
        if (input) pilot.lastSeq = input.seq;
        return input ?? { ...IDLE_ORBITAL, seq: pilot.lastSeq, targetId: pilot.lockTargetId };
      });
      for (const pilot of pilots) {
        if (!pilot.alive) continue;
        const input = inputs[pilot.slotId];
        pilot.lockTargetId = input.targetId;
        pilot.fireCd = Math.max(0, pilot.fireCd - ORBITAL_DT);
        pilot.hurtT = Math.max(0, pilot.hurtT - ORBITAL_DT);
        integrateSpatialFlight(pilot, input, ORBITAL_DT, 1, rocks, SHIPS[pilot.ship]);
      }
      for (const pilot of pilots) {
        if (!pilot.alive) continue;
        const input = inputs[pilot.slotId];
        const target = pilots.find((c) => c.id === pilot.lockTargetId && c.faction !== pilot.faction);
         const missileWeapon = MISSILE_CATALOG[SHIPS[pilot.ship].missileFit];
         acquireTarget(pilot, target, ORBITAL_DT, rocks, missileWeapon);
         if (input.countermeasure) {
           const result = deployCountermeasure(bullets, pilot);
           if (result.activated) {
             events.push({
               type: "countermeasure", source: pilot.id, target: pilot.id,
               decoyed: result.decoyed, disrupted: result.disrupted,
             });
           }
         }
        if (input.missile) {
           const salvo = spawnMissileVolley(pilot, target, bullets.length, SHIPS[pilot.ship].missileDamage, rocks, missileWeapon);
           if (salvo.length) {
             bullets.push(...salvo.map((missile) => ({ ...missile, owner: pilot.id, faction: pilot.faction })));
             events.push({ type: "missile", source: pilot.id, target: salvo[0]!.homeId! });
          }
        }
         const primaryWeapon = PRIMARY_WEAPON_CATALOG[SHIPS[pilot.ship].primaryFit];
         if (input.fire && pilot.fireCd <= 0 && pilot.root <= 0 && bullets.length + primaryWeapon.volleyCount <= PROJECTILE_LIMIT) {
          const def = SHIPS[pilot.ship];
           const salvo = spawnPrimaryVolley(pilot, target, def.shotSpeed, def.shotDmg, rocks, primaryWeapon);
           bullets.push(...salvo.map((bullet) => ({ ...bullet, owner: pilot.id, faction: pilot.faction })));
          pilot.fireCd = def.fireInterval;
        }
        if (pilot.hurtT <= 0) pilot.shield = Math.min(pilot.shieldMax, pilot.shield + 3 * ORBITAL_DT);
      }
      bullets = bullets.filter((bullet) => {
        const target = bullet.homeId == null
          ? undefined
          : pilots.find((c) => c.id === bullet.homeId && c.alive && c.cloak <= 0);
        if (bullet.missile) {
          guideMissile(bullet, target, ORBITAL_DT, pilots.find((pilot) => pilot.id === bullet.launcherId));
        }
        const px = bullet.x; const py = bullet.y ?? 0; const pz = bullet.z;
        bullet.x += bullet.vx * ORBITAL_DT; bullet.y = py + (bullet.vy ?? 0) * ORBITAL_DT; bullet.z += bullet.vz * ORBITAL_DT; bullet.life -= ORBITAL_DT;
        if (bullet.life <= 0) return false;
        if (rocks.some((rock) => segmentHit(rock.x, rock.y ?? 0, rock.z, bullet, px, py, pz, rock.r))) return false;
        for (const pilot of pilots) {
          if (pilot.faction === bullet.faction || !pilot.alive || !segmentHit(pilot.x, pilot.space.y, pilot.z, bullet, px, py, pz, pilot.radius + bullet.r)) continue;
          applyDamage(pilot, bullet);
          return false;
        }
        return true;
      });
      const ussf = pilots.filter((pilot) => pilot.faction === "ussf" && pilot.alive);
      const accord = pilots.filter((pilot) => pilot.faction === "accord" && pilot.alive);
      if (!ussf.length || !accord.length) over = ussf.length ? "ussf" : accord.length ? "accord" : "draw";
      else if (tick >= 120 / ORBITAL_DT) {
        const integrity = (team: Pilot[]) => team.reduce((sum, c) => sum + c.hull + c.shield + c.space.armor, 0);
        const difference = integrity(ussf) - integrity(accord);
        over = Math.abs(difference) < 1e-6 ? "draw" : difference > 0 ? "ussf" : "accord";
      }
      return snapshot();
    },
  };
}
