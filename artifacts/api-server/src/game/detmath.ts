// Deterministic transcendental math for reward-adjudicated simulation.
//
// ECMAScript leaves Math.sin, Math.cos, Math.atan2, Math.exp, and Math.hypot
// implementation-approximated. Node 24 and Chromium 156 return different bits
// for tens of thousands of ordinary inputs, so an identical replay can resolve
// differently on the player's browser and on the reward server.
//
// These are direct ports of the FreeBSD/Sun fdlibm algorithms. They use only
// IEEE-754 double addition, subtraction, multiplication, division, and
// Math.sqrt, which are correctly rounded in every supported JavaScript runtime,
// so they return the same bits everywhere. Results stay within about one unit in
// the last place of the native functions, so gameplay and balance are unchanged.
//
// This file must stay byte-identical between the browser and the API server.

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);
const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
const HI = LITTLE_ENDIAN ? 1 : 0;
const LO = LITTLE_ENDIAN ? 0 : 1;

function highWord(x: number) {
  f64[0] = x;
  return u32[HI] | 0;
}

function lowWord(x: number) {
  f64[0] = x;
  return u32[LO];
}

function withHighWord(x: number, hi: number) {
  f64[0] = x;
  u32[HI] = hi >>> 0;
  return f64[0];
}

// ---------------------------------------------------------------------------
// Argument reduction: x = n * pi/2 + (y0 + y1)
// ---------------------------------------------------------------------------

const INV_PIO2 = 6.36619772367581382433e-01;
const PIO2_1 = 1.57079632673412561417e+00;
const PIO2_1T = 6.07710050650619224932e-11;
const PIO2_2 = 6.07710050630396597660e-11;
const PIO2_2T = 2.02226624879595063154e-21;
const PIO2_3 = 2.02226624871116645580e-21;
const PIO2_3T = 8.47842766036889956997e-32;

let reducedHi = 0;
let reducedLo = 0;

function remPio2(x: number) {
  const hx = highWord(x);
  const ix = hx & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    // |x| <= pi/4: no reduction needed.
    reducedHi = x;
    reducedLo = 0;
    return 0;
  }
  if (ix < 0x4002d97c) {
    // |x| < 3pi/4
    if (hx > 0) {
      let z = x - PIO2_1;
      if (ix !== 0x3ff921fb) {
        reducedHi = z - PIO2_1T;
        reducedLo = (z - reducedHi) - PIO2_1T;
      } else {
        z -= PIO2_2;
        reducedHi = z - PIO2_2T;
        reducedLo = (z - reducedHi) - PIO2_2T;
      }
      return 1;
    }
    let z = x + PIO2_1;
    if (ix !== 0x3ff921fb) {
      reducedHi = z + PIO2_1T;
      reducedLo = (z - reducedHi) + PIO2_1T;
    } else {
      z += PIO2_2;
      reducedHi = z + PIO2_2T;
      reducedLo = (z - reducedHi) + PIO2_2T;
    }
    return -1;
  }
  if (ix > 0x413921fb) {
    // |x| > 2^19 * pi/2. The simulation only produces bounded angles, so the
    // Payne-Hanek path is replaced by an exact IEEE remainder. The result is
    // deterministic and finite, though less accurate for huge inputs.
    return remPio2(x % 6.283185307179586);
  }
  // Medium arguments: three-part Cody-Waite reduction.
  const t = Math.abs(x);
  const n = Math.floor(t * INV_PIO2 + 0.5);
  const fn = n;
  let r = t - fn * PIO2_1;
  let w = fn * PIO2_1T;
  const j = ix >> 20;
  reducedHi = r - w;
  let i = j - ((highWord(reducedHi) >> 20) & 0x7ff);
  if (i > 16) {
    let tt = r;
    w = fn * PIO2_2;
    r = tt - w;
    w = fn * PIO2_2T - ((tt - r) - w);
    reducedHi = r - w;
    i = j - ((highWord(reducedHi) >> 20) & 0x7ff);
    if (i > 49) {
      tt = r;
      w = fn * PIO2_3;
      r = tt - w;
      w = fn * PIO2_3T - ((tt - r) - w);
      reducedHi = r - w;
    }
  }
  reducedLo = (r - reducedHi) - w;
  const quadrant = n % 4;
  if (hx < 0) {
    reducedHi = -reducedHi;
    reducedLo = -reducedLo;
    return -quadrant;
  }
  return quadrant;
}

// ---------------------------------------------------------------------------
// Kernels on [-pi/4, pi/4]
// ---------------------------------------------------------------------------

const S1 = -1.66666666666666324348e-01;
const S2 = 8.33333333332248946124e-03;
const S3 = -1.98412698298579493134e-04;
const S4 = 2.75573137070700676789e-06;
const S5 = -2.50507602534068634195e-08;
const S6 = 1.58969099521155010221e-10;

function kernelSin(x: number, y: number, hasTail: boolean) {
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  if (!hasTail) return x + v * (S1 + z * r);
  return x - ((z * (0.5 * y - v * r) - y) - v * S1);
}

const C1 = 4.16666666666666019037e-02;
const C2 = -1.38888888888741095749e-03;
const C3 = 2.48015872894767294178e-05;
const C4 = -2.75573143513906633035e-07;
const C5 = 2.08757232129817482790e-09;
const C6 = -1.13596475577881948265e-11;

function kernelCos(x: number, y: number) {
  const z = x * x;
  const w = z * z;
  const r = z * (C1 + z * (C2 + z * C3)) + w * w * (C4 + z * (C5 + z * C6));
  const hz = 0.5 * z;
  const one = 1.0 - hz;
  return one + (((1.0 - one) - hz) + (z * r - x * y));
}

export function detSin(x: number) {
  const ix = highWord(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    if (ix < 0x3e400000) return x;
    return kernelSin(x, 0, false);
  }
  if (ix >= 0x7ff00000) return NaN;
  const n = remPio2(x) & 3;
  if (n === 0) return kernelSin(reducedHi, reducedLo, true);
  if (n === 1) return kernelCos(reducedHi, reducedLo);
  if (n === 2) return -kernelSin(reducedHi, reducedLo, true);
  return -kernelCos(reducedHi, reducedLo);
}

export function detCos(x: number) {
  const ix = highWord(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    if (ix < 0x3e400000) return 1;
    return kernelCos(x, 0);
  }
  if (ix >= 0x7ff00000) return NaN;
  const n = remPio2(x) & 3;
  if (n === 0) return kernelCos(reducedHi, reducedLo);
  if (n === 1) return -kernelSin(reducedHi, reducedLo, true);
  if (n === 2) return -kernelCos(reducedHi, reducedLo);
  return kernelSin(reducedHi, reducedLo, true);
}

// ---------------------------------------------------------------------------
// atan / atan2
// ---------------------------------------------------------------------------

const ATAN_HI = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
const ATAN_LO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT0 = 3.33333333333329318027e-01;
const AT1 = -1.99999999998764832476e-01;
const AT2 = 1.42857142725034663711e-01;
const AT3 = -1.11111104054623557880e-01;
const AT4 = 9.09088713343650656196e-02;
const AT5 = -7.69187620504482999495e-02;
const AT6 = 6.66107313738753120669e-02;
const AT7 = -5.83357013379057348645e-02;
const AT8 = 4.97687799461593236017e-02;
const AT9 = -3.65315727442169155270e-02;
const AT10 = 1.62858201153657823623e-02;

export function detAtan(input: number) {
  let x = input;
  const hx = highWord(x);
  const ix = hx & 0x7fffffff;
  let id: number;
  if (ix >= 0x44100000) {
    // |x| >= 2^66
    if (x !== x) return x;
    return hx > 0 ? ATAN_HI[3] + ATAN_LO[3] : -ATAN_HI[3] - ATAN_LO[3];
  }
  if (ix < 0x3fdc0000) {
    // |x| < 0.4375
    if (ix < 0x3e400000) return x;
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {
      if (ix < 0x3fe60000) {
        id = 0;
        x = (2.0 * x - 1.0) / (2.0 + x);
      } else {
        id = 1;
        x = (x - 1.0) / (x + 1.0);
      }
    } else if (ix < 0x40038000) {
      id = 2;
      x = (x - 1.5) / (1.0 + 1.5 * x);
    } else {
      id = 3;
      x = -1.0 / x;
    }
  }
  const z = x * x;
  const w = z * z;
  const s1 = z * (AT0 + w * (AT2 + w * (AT4 + w * (AT6 + w * (AT8 + w * AT10)))));
  const s2 = w * (AT1 + w * (AT3 + w * (AT5 + w * (AT7 + w * AT9))));
  if (id < 0) return x - x * (s1 + s2);
  const result = ATAN_HI[id] - ((x * (s1 + s2) - ATAN_LO[id]) - x);
  return hx < 0 ? -result : result;
}

const PI = 3.1415926535897931160e+00;
const PI_O_2 = 1.5707963267948965580e+00;
const PI_O_4 = 7.8539816339744827900e-01;
const PI_LO = 1.2246467991473531772e-16;

export function detAtan2(y: number, x: number) {
  if (x !== x || y !== y) return NaN;
  const hx = highWord(x);
  const ix = hx & 0x7fffffff;
  const lx = lowWord(x);
  const hy = highWord(y);
  const iy = hy & 0x7fffffff;
  const ly = lowWord(y);
  if (hx === 0x3ff00000 && lx === 0) return detAtan(y);
  const m = ((hy >>> 31) & 1) | ((hx >>> 30) & 2);
  if (iy === 0 && ly === 0) {
    if (m === 0 || m === 1) return y;
    return m === 2 ? PI : -PI;
  }
  if (ix === 0 && lx === 0) return hy < 0 ? -PI_O_2 : PI_O_2;
  if (ix === 0x7ff00000) {
    if (iy === 0x7ff00000) {
      if (m === 0) return PI_O_4;
      if (m === 1) return -PI_O_4;
      if (m === 2) return 3.0 * PI_O_4;
      return -3.0 * PI_O_4;
    }
    if (m === 0) return 0;
    if (m === 1) return -0;
    if (m === 2) return PI;
    return -PI;
  }
  if (iy === 0x7ff00000) return hy < 0 ? -PI_O_2 : PI_O_2;
  const k = (iy - ix) >> 20;
  let z: number;
  if (k > 60) z = PI_O_2 + 0.5 * PI_LO;
  else if (hx < 0 && k < -60) z = 0.0;
  else z = detAtan(Math.abs(y / x));
  if (m === 0) return z;
  if (m === 1) return -z;
  if (m === 2) return PI - (z - PI_LO);
  return (z - PI_LO) - PI;
}

// ---------------------------------------------------------------------------
// exp
// ---------------------------------------------------------------------------

const LN2_HI = 6.93147180369123816490e-01;
const LN2_LO = 1.90821492927058770002e-10;
const INV_LN2 = 1.44269504088896338700e+00;
const O_THRESHOLD = 7.09782712893383973096e+02;
const U_THRESHOLD = -7.45133219101941108420e+02;
const TWO_M1000 = 9.33263618503218878990e-302;
const P1 = 1.66666666666666019037e-01;
const P2 = -2.77777777770155933842e-03;
const P3 = 6.61375632143793436117e-05;
const P4 = -1.65339022054652515390e-06;
const P5 = 4.13813679705723846039e-08;

export function detExp(input: number) {
  let x = input;
  if (x !== x) return NaN;
  const raw = highWord(x);
  const negative = raw < 0;
  const hx = raw & 0x7fffffff;
  if (hx >= 0x40862e42) {
    // |x| >= 709.78
    if (hx >= 0x7ff00000) return negative ? 0 : Infinity;
    if (x > O_THRESHOLD) return Infinity;
    if (x < U_THRESHOLD) return 0;
  }
  let hi = 0;
  let lo = 0;
  let k = 0;
  if (hx > 0x3fd62e42) {
    // |x| > 0.5 ln2
    if (hx < 0x3ff0a2b2) {
      // |x| < 1.5 ln2
      hi = negative ? x + LN2_HI : x - LN2_HI;
      lo = negative ? -LN2_LO : LN2_LO;
      k = negative ? -1 : 1;
    } else {
      k = Math.trunc(INV_LN2 * x + (negative ? -0.5 : 0.5));
      hi = x - k * LN2_HI;
      lo = k * LN2_LO;
    }
    x = hi - lo;
  } else if (hx < 0x3e300000) {
    // |x| < 2^-28
    return 1 + x;
  }
  const t = x * x;
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1 - ((x * c) / (c - 2.0) - x);
  const y = 1 - ((lo - (x * c) / (2.0 - c)) - hi);
  if (k >= -1021) return withHighWord(y, highWord(y) + (k << 20));
  return withHighWord(y, highWord(y) + ((k + 1000) << 20)) * TWO_M1000;
}

// ---------------------------------------------------------------------------
// hypot
// ---------------------------------------------------------------------------

// Simulation distances are bounded well inside the double range, so the plain
// correctly rounded formula is both deterministic and sufficient.
export function detHypot(x: number, y: number) {
  return Math.sqrt(x * x + y * y);
}
