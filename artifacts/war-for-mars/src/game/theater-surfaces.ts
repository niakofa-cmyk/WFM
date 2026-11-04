import * as THREE from "three";

/** Render-only detail. Never use this noise, or its output, in match simulation. */
function noise(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const smooth = (v: number) => v * v * (3 - 2 * v);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const fz = smooth(z - iz);
  let value = 0;
  for (let dz = 0; dz <= 1; dz++) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        let h = Math.imul(ix + dx, 374761393)
          ^ Math.imul(iy + dy, 668265263)
          ^ Math.imul(iz + dz, 1274126177);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        const sample = ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
        value += sample * (dx ? fx : 1 - fx)
          * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
      }
    }
  }
  return value;
}

export const THEATER_TEXTURE_BUDGET = {
  marsWidth: 256,
  marsHeight: 128,
  basaltSize: 64,
  /** RGBA bytes before mipmaps: 144 KiB, generated once per mounted Arena. */
  rgbaBytes: (256 * 128 + 64 * 64) * 4,
} as const;

/**
 * A small equirectangular surface sampled in sphere space. Its longitude seam
 * and poles match; there are no downloads, canvas allocations or shared RNG.
 */
export function marsSurfacePixels(): Uint8Array {
  const { marsWidth: width, marsHeight: height } = THEATER_TEXTURE_BUDGET;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const latitude = Math.PI * y / (height - 1);
    const sinLatitude = y === 0 || y === height - 1 ? 0 : Math.sin(latitude);
    for (let x = 0; x < width; x++) {
      // The last column deliberately samples the first, avoiding roundoff seams.
      const longitude = x === width - 1 ? 0 : Math.PI * 2 * x / (width - 1);
      const sx = Math.cos(longitude) * sinLatitude;
      const sy = Math.cos(latitude);
      const sz = Math.sin(longitude) * sinLatitude;
      const broad = noise(sx * 4 + 11, sy * 4 + 9, sz * 4 + 7);
      const detail = noise(sx * 17 + 20, sy * 17 + 18, sz * 17 + 15);
      const ridge = Math.abs(detail - 0.48);
      const elevation = broad * 0.72 + detail * 0.28;
      const shade = 0.46 + elevation * 0.68 - ridge * 0.28;
      const frost = Math.max(0, (Math.abs(sy) - 0.976) / 0.024) * 0.68;
      const i = (y * width + x) * 4;
      pixels[i] = Math.round(174 * shade * (1 - frost) + 187 * frost);
      pixels[i + 1] = Math.round(89 * shade * (1 - frost) + 171 * frost);
      pixels[i + 2] = Math.round(62 * shade * (1 - frost) + 151 * frost);
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

export function basaltSurfacePixels(): Uint8Array {
  const size = THEATER_TEXTURE_BUDGET.basaltSize;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1) * Math.PI * 2;
      const v = y / (size - 1) * Math.PI * 2;
      const n = noise(Math.cos(u) * 3 + 10, Math.sin(u) * 3 + 10,
        Math.cos(v) * 3 + Math.sin(v) * 3 + 10);
      const shade = Math.round(155 + n * 100);
      const i = (y * size + x) * 4;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = shade;
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

export function createTheaterTextures() {
  const mars = new THREE.DataTexture(
    marsSurfacePixels(), THEATER_TEXTURE_BUDGET.marsWidth,
    THEATER_TEXTURE_BUDGET.marsHeight, THREE.RGBAFormat,
  );
  mars.wrapS = THREE.RepeatWrapping;
  mars.colorSpace = THREE.SRGBColorSpace;
  const basalt = new THREE.DataTexture(
    basaltSurfacePixels(), THEATER_TEXTURE_BUDGET.basaltSize,
    THEATER_TEXTURE_BUDGET.basaltSize, THREE.RGBAFormat,
  );
  basalt.wrapS = basalt.wrapT = THREE.RepeatWrapping;
  basalt.repeat.set(12, 12);
  basalt.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [mars, basalt]) {
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
  }
  return {
    mars,
    basalt,
    dispose() {
      mars.dispose();
      basalt.dispose();
    },
  };
}

/** One small silhouette shell, not bloom or a full-screen postprocessing pass. */
export function createMarsLimb(color: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(28.35, 32, 24),
    new THREE.ShaderMaterial({
      uniforms: { tint: { value: new THREE.Color(color) } },
      vertexShader: `
        varying vec3 worldNormal;
        varying vec3 eye;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          worldNormal = mat3(modelMatrix) * normal;
          eye = cameraPosition - world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform vec3 tint;
        varying vec3 worldNormal;
        varying vec3 eye;
        void main() {
          float edge = 1.0 - abs(dot(normalize(worldNormal), normalize(eye)));
          gl_FragColor = vec4(tint, pow(edge, 3.5) * 0.18);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
}
