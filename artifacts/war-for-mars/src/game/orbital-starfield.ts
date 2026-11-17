export type OrbitalStarfieldBuffers = {
  positions: Float32Array;
  phases: Float32Array;
};

/**
 * Deterministic background-star samples for the existing Orbital renderer.
 * This module deliberately contains no renderer imports so the sector data
 * remains independent of its presentation backend.
 */
export function createOrbitalStarfieldBuffers(
  seed: number,
  count = 700,
): OrbitalStarfieldBuffers {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new Error("Starfield seed must be an unsigned 32-bit integer.");
  }
  if (!Number.isSafeInteger(count) || count < 1 || count > 20_000) {
    throw new Error("Starfield count must be between 1 and 20000.");
  }

  let state = seed >>> 0 || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);

  for (let index = 0; index < count; index++) {
    const radius = 160 + random() * 180;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.cos(phi) * 0.55;
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    phases[index] = random() * Math.PI * 2;
  }

  return { positions, phases };
}
