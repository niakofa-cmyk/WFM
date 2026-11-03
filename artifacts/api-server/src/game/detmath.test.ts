import assert from "node:assert/strict";
import test from "node:test";
import { detAtan2, detCos, detExp, detHypot, detSin } from "./detmath";

function bits(value: number) {
  const view = new Float64Array([value]);
  return new BigUint64Array(view.buffer)[0].toString(16).padStart(16, "0");
}

function ulps(a: number, b: number) {
  if (Object.is(a, b)) return 0;
  const view = new Float64Array([a, b]);
  const ints = new BigInt64Array(view.buffer);
  const diff = ints[0] - ints[1];
  return Number(diff < 0n ? -diff : diff);
}

test("deterministic math returns pinned IEEE-754 bits in every runtime", () => {
  // These bit patterns are produced by pure double arithmetic, so any
  // JavaScript runtime must reproduce them exactly. A change here means the
  // browser and the reward server may no longer agree on a replay.
  const expected: Array<[number, string, string, string]> = [
    [0.5, "3fdeaee8744b05f0", "3fec1528065b7d50", "3fee7078b0a726a6"],
    [1, "3feaed548f090cee", "3fe14a280fb5068c", "3fecf46d99d52b3a"],
    [2.5, "3fe326af0dcfcab0", "bfe9a2f7ef858b7d", "3fe8ebef9eac820b"],
    [-3, "bfc210386db6d55b", "bfefae04be85e5d2", "3ff599058c8c1a96"],
    [100.25, "bfd1bf00980dc35c", "3feebec72ba6b0ec", "3f073706e8260ad2"],
    [1000.125, "3fec7f52cd394760", "3fdd1d15d1656482", "36ea37b2d9d585af"],
  ];
  for (const [x, sin, cos, exp] of expected) {
    assert.equal(bits(detSin(x)), sin, `sin(${x})`);
    assert.equal(bits(detCos(x)), cos, `cos(${x})`);
    assert.equal(bits(detExp(-x / 10)), exp, `exp(${-x / 10})`);
  }
  const atan2: Array<[number, number, string]> = [
    [1, 2, "3fddac670561bb4f"],
    [-3, 0.5, "bff67d8863bc99bd"],
    [7, -11, "40049952004c912e"],
    [-0.25, -40, "c009152e92638367"],
  ];
  for (const [y, x, expectedBits] of atan2) assert.equal(bits(detAtan2(y, x)), expectedBits, `atan2(${y}, ${x})`);
});

test("deterministic math stays within two units in the last place of native Math", () => {
  let seed = 99;
  const random = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  const worst = { sin: 0, cos: 0, atan2: 0, exp: 0, hypot: 0 };
  const scales = [1e-9, 1e-3, 1, 4, 20, 1000, 1e5];
  for (let i = 0; i < 200_000; i++) {
    const a = (random() - 0.5) * 2 * scales[i % scales.length];
    const y = (random() - 0.5) * 400;
    const x = (random() - 0.5) * 400;
    worst.sin = Math.max(worst.sin, ulps(detSin(a), Math.sin(a)));
    worst.cos = Math.max(worst.cos, ulps(detCos(a), Math.cos(a)));
    worst.atan2 = Math.max(worst.atan2, ulps(detAtan2(y, x), Math.atan2(y, x)), ulps(detAtan2(a, x), Math.atan2(a, x)));
    worst.exp = Math.max(worst.exp, ulps(detExp(a % 700), Math.exp(a % 700)));
    worst.hypot = Math.max(worst.hypot, ulps(detHypot(y, x), Math.hypot(y, x)));
  }
  for (const [name, error] of Object.entries(worst)) assert.ok(error <= 2, `${name} differs from native by ${error} ulps`);
});

test("deterministic math preserves special values", () => {
  const atan2Cases: Array<[number, number]> = [
    [0, 0], [-0, 0], [0, -0], [-0, -0], [1, 0], [-1, 0], [0, -1], [-0, -1],
    [Infinity, Infinity], [-Infinity, -Infinity], [1, Infinity], [1, -Infinity], [Infinity, 1], [NaN, 1], [1, NaN],
  ];
  for (const [y, x] of atan2Cases) assert.ok(Object.is(detAtan2(y, x), Math.atan2(y, x)), `atan2(${y}, ${x})`);
  for (const x of [0, -0, Math.PI / 2, Math.PI, -Math.PI, 2 * Math.PI]) {
    assert.ok(Object.is(detSin(x), Math.sin(x)), `sin(${x})`);
    assert.ok(Object.is(detCos(x), Math.cos(x)), `cos(${x})`);
  }
  assert.ok(Number.isNaN(detSin(Infinity)));
  assert.ok(Number.isNaN(detCos(NaN)));
  assert.ok(Number.isFinite(detSin(1e300)), "huge angles stay finite");
  assert.equal(detExp(0), 1);
  assert.equal(detExp(-Infinity), 0);
  assert.equal(detExp(Infinity), Infinity);
  assert.equal(detExp(1000), Infinity);
  assert.equal(detExp(-1000), 0);
  assert.ok(Number.isNaN(detExp(NaN)));
});
