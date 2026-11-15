import assert from "node:assert/strict";
import test from "node:test";
import { firstWorldImpact, newFlight, resolveUniverseMotion, universeCollidersAt,
  universeCollisionSpheres, movingSphereImpact, type SpatialCraft } from "@workspace/orbital-sim";

function craft(x: number, z = 0): SpatialCraft {
  return { id: 1, x, z, yaw: 0, pitch: 0, speed: 1000, steer: 0,
    hull: 100, hullMax: 100, alive: true, root: 0, jam: 0, boost: 0,
    cloak: 0, untargetable: 0, radius: 1, lockTargetId: null, space: newFlight(0) };
}

test("universe swept collision blocks high-speed tunneling without inventing damage", () => {
  const ship = craft(20);
  ship.space!.vx = 1200;
  const rocks = [{ x: 0, y: 0, z: 0, r: 2 }];
  assert.equal(resolveUniverseMotion(ship, { x: -20, y: 0, z: 0 }, rocks), true);
  assert.ok(ship.x < -3);
  assert.equal(ship.space!.vx, 0);
  assert.equal(ship.hull, 100);
});

test("center penetration recovers a finite surface and tangent flight is preserved", () => {
  const ship = craft(0);
  ship.space!.vz = 10;
  assert.equal(resolveUniverseMotion(ship, { x: 0, y: 0, z: 0 }, [{ x: 0, z: 0, r: 5 }]), true);
  assert.ok(ship.x > 6);
  assert.equal(ship.space!.vz, 10);
});

test("world cover selects the first physical contact, including projectile radius", () => {
  const hit = firstWorldImpact({ x: -10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 },
    [{ x: 5, z: 0, r: 1 }, { x: 0, z: 0, r: 2 }], 1);
  assert.equal(hit?.rock.x, 0);
  assert.ok(Math.abs(hit!.time - .35) < 1e-10);
  assert.equal(firstWorldImpact({ x: -10, y: 10, z: 0 }, { x: 10, y: 10, z: 0 },
    [{ x: 0, z: 0, r: 2 }]), null);
});

test("a target crossing the bullet path is hit at contact time, not only its end pose", () => {
  const time = movingSphereImpact({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 },
    { x: -5, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, 1);
  assert.ok(time !== null && Math.abs(time - .4) < 1e-10);
});

test("server and sector presentation share Mars and streamed asteroid coordinates", () => {
  const rocks = universeCollisionSpheres({ x: "0", y: "0", z: "0" });
  const mars = rocks.find(r => r.r === 65)!;
  assert.deepEqual(mars, { x: -100, y: 20.1, z: -200, r: 65 });
  const shifted = universeCollidersAt({ x: 0, y: 0, z: -300 });
  assert.deepEqual(shifted.find(r => r.r === 65), mars);
  assert.equal(universeCollidersAt({ x: 0, y: 0, z: -300 }), shifted);
  assert.deepEqual(rocks.find(r => r.r === 7), { x: 100, y: 49.1, z: -210, r: 7 });
  assert.ok(rocks.length <= 136);
  assert.throws(() => universeCollidersAt({ x: Infinity, y: 0, z: 0 }));
});
