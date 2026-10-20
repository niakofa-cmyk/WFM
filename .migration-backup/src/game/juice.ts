export type Spark = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
};

export function freshSpark(): Spark {
  return { x: 0, y: -40, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 0.3 };
}

export function addTrauma(trauma: number, amount: number) {
  return Math.min(1, Math.max(0, trauma) + amount);
}

export function decayTrauma(trauma: number, dt: number, rate = 1.7) {
  return Math.max(0, trauma - rate * dt);
}

export function shakeMag(trauma: number) {
  const t = Math.max(0, Math.min(1, trauma));
  return t * t;
}

export function shakeNoise(t: number, seed: number) {
  return Math.sin(t * 37.2 + seed * 12.3) * Math.cos(t * 17.1 + seed);
}

export function emitSparks(pool: Spark[], x: number, z: number, count: number, speed: number, life: number) {
  let spawned = 0;
  for (const spark of pool) {
    if (spark.life > 0) continue;
    const angle = Math.random() * Math.PI * 2;
    spark.x = x;
    spark.y = 0.7;
    spark.z = z;
    spark.vx = Math.cos(angle) * speed;
    spark.vy = (0.35 + Math.random()) * speed;
    spark.vz = Math.sin(angle) * speed;
    spark.life = life;
    spark.max = life;
    spawned += 1;
    if (spawned >= count) break;
  }
}

export function tickSparks(pool: Spark[], dt: number) {
  for (const spark of pool) {
    if (spark.life <= 0) continue;
    spark.life = Math.max(0, spark.life - dt);
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.z += spark.vz * dt;
    spark.vy -= 7 * dt;
    if (spark.life <= 0) spark.y = -40;
  }
}
