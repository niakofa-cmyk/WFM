import { rotate, type Rock, type SpatialCraft } from "./flight";
import { sphereSweepTime } from "./weapons";
import { detHypot } from "./detmath";

type Point = { x: number; y: number; z: number };
type Address = { x: string; y: string; z: string };
import { seedUniverseSector } from "./universe-sector-seeding";

const cache = new Map<string, Rock[]>();
const absoluteCache = new Map<string, Rock[]>();

/** Same bounded sector content for presentation, prediction and authority. */
export function universeCollisionSpheres(address: Address): Rock[] {
  const base = [BigInt(address.x), BigInt(address.y), BigInt(address.z)];
  const key = base.join(":");
  const retained = cache.get(key);
  if (retained) return retained;
  const rocks: Rock[] = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const cell = [base[0]! + BigInt(x), base[1]! + BigInt(y), base[2]! + BigInt(z)];
    if (cell.every(n => n === 0n)) continue; // Origin training scenery is not streamed.
    for (const rock of seedUniverseSector(cell.join(":")).asteroids) {
      rocks.push({ x: x * 512 + rock.x, y: y * 512 + rock.y, z: z * 512 + rock.z, r: rock.r });
    }
  }
  if (base.every(n => n >= -1n && n <= 1n)) {
    // Physics Y excludes the renderer's +0.9m presentation offset.
    rocks.push({ x: -100 - Number(base[0]) * 512, y: 20.1 - Number(base[1]) * 512,
      z: -200 - Number(base[2]) * 512, r: 65 });
    rocks.push({ x: 100 - Number(base[0]) * 512, y: 49.1 - Number(base[1]) * 512,
      z: -210 - Number(base[2]) * 512, r: 7 });
  }
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(key, rocks);
  return rocks;
}

/** Server coordinates remain absolute; visual sectors are centered every 512m. */
export function universeCollidersAt(point: Point): Rock[] {
  const cell = [point.x, point.y, point.z].map(n => Math.floor((n + 256) / 512));
  if (!cell.every(Number.isSafeInteger)) throw new RangeError("Invalid universe collision coordinate");
  const key = cell.join(":");
  const retained = absoluteCache.get(key);
  if (retained) return retained;
  const result = universeCollisionSpheres({ x: String(cell[0]), y: String(cell[1]), z: String(cell[2]) })
    .map(rock => ({ ...rock, x: rock.x + cell[0]! * 512,
      y: (rock.y ?? 0) + cell[1]! * 512, z: rock.z + cell[2]! * 512 }));
  if (absoluteCache.size >= 64) absoluteCache.delete(absoluteCache.keys().next().value!);
  absoluteCache.set(key, result);
  return result;
}

export function firstWorldImpact(from: Point, to: Point, rocks: readonly Rock[], radius = 0) {
  let hit: { rock: Rock; time: number } | null = null;
  for (const rock of rocks) {
    const time = sphereSweepTime(from, to, { x: rock.x, y: rock.y ?? 0, z: rock.z }, rock.r + radius);
    if (time !== null && (!hit || time < hit.time)) hit = { rock, time };
  }
  return hit;
}

export function movingSphereImpact(from: Point, to: Point, previous: Point, current: Point, radius: number) {
  return sphereSweepTime(
    { x: from.x - previous.x, y: from.y - previous.y, z: from.z - previous.z },
    { x: to.x - current.x, y: to.y - current.y, z: to.z - current.z },
    { x: 0, y: 0, z: 0 }, radius,
  );
}

/** Conservative swept contact; no damage, teleport destination or invulnerability. */
export function resolveUniverseMotion(craft: SpatialCraft, from: Point, rocks: readonly Rock[]): boolean {
  const s = craft.space!;
  const to = { x: craft.x, y: s.y, z: craft.z };
  const hit = firstWorldImpact(from, to, rocks, craft.radius);
  if (!hit) return false;
  const center = { x: hit.rock.x, y: hit.rock.y ?? 0, z: hit.rock.z };
  const t = Math.max(0, hit.time - 1e-6);
  const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t };
  let nx = point.x - center.x, ny = point.y - center.y, nz = point.z - center.z;
  const length = detHypot(detHypot(nx, ny), nz);
  if (length < 1e-9) { nx = 1; ny = 0; nz = 0; }
  else { nx /= length; ny /= length; nz /= length; }
  const separation = hit.rock.r + craft.radius + 1e-5;
  craft.x = center.x + nx * separation;
  s.y = center.y + ny * separation;
  craft.z = center.z + nz * separation;
  const inward = Math.min(0, s.vx * nx + s.vy * ny + s.vz * nz);
  s.vx -= inward * nx; s.vy -= inward * ny; s.vz -= inward * nz;
  const forward = rotate(s.q, 0, 0, -1);
  craft.speed = s.vx * forward.x + s.vy * forward.y + s.vz * forward.z;
  return true;
}
