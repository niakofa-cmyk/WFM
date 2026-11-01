import assert from "node:assert/strict";
import test from "node:test";
import {
  THEATER_TEXTURE_BUDGET,
  basaltSurfacePixels,
  createTheaterTextures,
  marsSurfacePixels,
} from "./theater-surfaces";

test("theater surfaces stay within a fixed 144 KiB RGBA budget", () => {
  assert.equal(marsSurfacePixels().length + basaltSurfacePixels().length,
    THEATER_TEXTURE_BUDGET.rgbaBytes);
  assert.equal(THEATER_TEXTURE_BUDGET.rgbaBytes, 147456);
});

test("surface generation is repeatable and does not consume shared random state", () => {
  const original = Math.random;
  Math.random = () => { throw new Error("render surfaces must not use shared RNG"); };
  try {
    assert.deepEqual(marsSurfacePixels(), marsSurfacePixels());
    assert.deepEqual(basaltSurfacePixels(), basaltSurfacePixels());
  } finally {
    Math.random = original;
  }
});

test("Mars texture has continuous longitude and uniform poles with opaque texels", () => {
  const p = marsSurfacePixels();
  const { marsWidth: w, marsHeight: h } = THEATER_TEXTURE_BUDGET;
  const pixel = (x: number, y: number) => p.slice((y * w + x) * 4, (y * w + x + 1) * 4);
  for (let y = 0; y < h; y++) assert.deepEqual(pixel(0, y), pixel(w - 1, y));
  for (const y of [0, h - 1]) {
    for (let x = 1; x < w; x++) assert.deepEqual(pixel(0, y), pixel(x, y));
  }
  for (let i = 3; i < p.length; i += 4) assert.equal(p[i], 255);
  assert.ok(new Set(p.filter((_, i) => i % 4 === 0)).size > 30);
});

test("both GPU texture resources are disposed on flight teardown", () => {
  const textures = createTheaterTextures();
  let disposed = 0;
  textures.mars.addEventListener("dispose", () => { disposed++; });
  textures.basalt.addEventListener("dispose", () => { disposed++; });
  textures.dispose();
  assert.equal(disposed, 2);
});

test("basalt repeats without visible texture-edge jumps", () => {
  const p = basaltSurfacePixels();
  const size = THEATER_TEXTURE_BUDGET.basaltSize;
  const pixel = (x: number, y: number) => p.slice((y * size + x) * 4, (y * size + x + 1) * 4);
  for (let n = 0; n < size; n++) {
    assert.deepEqual(pixel(0, n), pixel(size - 1, n));
    assert.deepEqual(pixel(n, 0), pixel(n, size - 1));
  }
});
