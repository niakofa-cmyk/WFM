import type { ShipId } from "./ships";

type Point = readonly [number, number];
type Section = readonly [z: number, halfWidth: number, halfHeight: number];
type HullSpec = {
  silhouette: string;
  sections: readonly Section[];
  wing: readonly Point[];
  engineOffsets: readonly number[];
  cockpit: readonly [width: number, length: number, height: number, z: number];
  hardpoints: readonly Point[];
  ring?: "saucer" | "triple" | "split";
  sensor?: "mast" | "dish" | "array";
};

/**
 * Low-poly native-renderer silhouettes. Coordinates follow the Orbital flight
 * convention: the nose points down -Z. These describe presentation only; they
 * never affect simulation tuning, collision, targeting, or damage.
 */
export const ORBITAL_NATIVE_HULLS: Record<ShipId, HullSpec> = {
  mandjet: {
    silhouette: "armored-solar-saucer",
    sections: [[-2.25,.15,.13],[-1.35,.48,.31],[-.25,.68,.42],[.82,.62,.34],[1.48,.38,.24],[1.9,.08,.08]],
    wing: [[.3,-1.25],[1.75,-1.02],[2.12,-.24],[1.95,.55],[1.22,1.08],[.34,.82]],
    engineOffsets: [-.48,-.16,.16,.48], cockpit: [.52,.92,.38,-.55],
    hardpoints: [[.92,-.42],[1.38,.16]], ring: "saucer", sensor: "dish",
  },
  shakuna: {
    silhouette: "needle-bird-interceptor",
    sections: [[-2.55,.08,.08],[-1.55,.18,.16],[-.35,.24,.19],[.82,.19,.14],[1.62,.1,.09],[2,.04,.04]],
    wing: [[.18,-1.05],[1.62,-.78],[2.28,.32],[1.32,1.42],[.42,1.06]],
    engineOffsets: [-.22,.22], cockpit: [.25,.7,.25,-.72],
    hardpoints: [[.65,-.18],[1.2,.26]], sensor: "mast",
  },
  sundara: {
    silhouette: "stealth-needle-bomber",
    sections: [[-2.45,.12,.1],[-1.38,.39,.24],[-.26,.52,.3],[.8,.43,.24],[1.52,.24,.17],[1.9,.06,.06]],
    wing: [[.26,-1.28],[1.18,-.98],[2.12,-.42],[1.82,.52],[1.12,1.22],[.28,.68]],
    engineOffsets: [-.4,.4], cockpit: [.36,.84,.29,-.58],
    hardpoints: [[.72,-.35],[1.28,.12],[.55,.62]], sensor: "dish",
  },
  tripura: {
    silhouette: "trinity-ring-support",
    sections: [[-2.15,.12,.12],[-1.35,.4,.27],[-.3,.55,.34],[.72,.43,.27],[1.43,.3,.2],[1.85,.05,.05]],
    wing: [[.28,-1.1],[1.4,-.78],[1.92,-.06],[1.56,.82],[.88,1.25],[.28,.72]],
    engineOffsets: [-.42,-.14,.14,.42], cockpit: [.43,.82,.33,-.5],
    hardpoints: [[.72,-.3],[1.12,.44]], ring: "triple", sensor: "array",
  },
  duskbreaker: {
    silhouette: "precision-dart-delta",
    sections: [[-2.5,.08,.08],[-1.55,.22,.17],[-.38,.34,.24],[.78,.26,.17],[1.55,.15,.12],[1.95,.04,.04]],
    wing: [[.2,-1.22],[1.12,-.86],[1.92,.45],[1.15,.22],[.34,.72]],
    engineOffsets: [-.26,.26], cockpit: [.31,.74,.29,-.68],
    hardpoints: [[.62,-.24],[1.15,.06]], sensor: "array",
  },
  sentinel: {
    silhouette: "broad-armored-escort",
    sections: [[-2.05,.16,.14],[-1.28,.48,.33],[-.22,.61,.42],[.78,.55,.36],[1.42,.36,.25],[1.82,.09,.08]],
    wing: [[.32,-1.05],[1.52,-.92],[2.12,-.42],[2.08,.52],[1.36,1.08],[.34,.76]],
    engineOffsets: [-.52,-.2,.2,.52], cockpit: [.56,.88,.4,-.48],
    hardpoints: [[1.04,-.34],[1.52,.08]], sensor: "array",
  },
  splitter: {
    silhouette: "split-ring-hunter",
    sections: [[-2.32,.1,.1],[-1.42,.25,.19],[-.25,.38,.27],[.88,.3,.2],[1.55,.16,.12],[1.9,.05,.05]],
    wing: [[.25,-1.12],[1.48,-.96],[2.02,-.1],[1.52,.86],[.94,1.12],[.28,.72]],
    engineOffsets: [-.38,0,.38], cockpit: [.35,.76,.3,-.55],
    hardpoints: [[.78,-.3],[1.2,.38]], ring: "split", sensor: "dish",
  },
  glide: {
    silhouette: "swept-glide-knife",
    sections: [[-2.55,.07,.07],[-1.55,.17,.14],[-.4,.25,.19],[.8,.19,.13],[1.58,.11,.08],[1.98,.03,.03]],
    wing: [[.18,-1.28],[1.88,-.88],[2.18,-.4],[1.32,1.12],[.58,.72],[.2,.26]],
    engineOffsets: [-.22,.22], cockpit: [.23,.68,.24,-.76],
    hardpoints: [[.78,-.22],[1.24,.24]], sensor: "mast",
  },
  wasp: {
    silhouette: "high-sweep-wasp",
    sections: [[-2.42,.07,.07],[-1.48,.18,.14],[-.25,.26,.18],[.86,.2,.13],[1.58,.1,.08],[1.94,.03,.03]],
    wing: [[.2,-1.08],[1.05,-.8],[2.32,-1.14],[1.78,.32],[1.12,1.28],[.3,.56]],
    engineOffsets: [-.24,.24], cockpit: [.23,.65,.23,-.7],
    hardpoints: [[.88,-.42],[1.5,-.54],[1.15,.44]], sensor: "mast",
  },
  valiant: {
    silhouette: "balanced-multirole-swept",
    sections: [[-2.28,.1,.1],[-1.4,.28,.21],[-.3,.4,.28],[.82,.33,.22],[1.52,.2,.14],[1.9,.04,.04]],
    wing: [[.25,-1.1],[1.32,-.86],[1.82,-.46],[1.9,.12],[1.32,.88],[.68,.75],[.25,.42]],
    engineOffsets: [-.3,.3], cockpit: [.34,.7,.28,-.57],
    hardpoints: [[.72,-.28],[1.26,.28]], sensor: "array",
  },
  aegis: {
    silhouette: "missile-defense-fortress",
    sections: [[-2.05,.15,.14],[-1.3,.5,.34],[-.2,.66,.45],[.84,.6,.39],[1.48,.4,.27],[1.84,.1,.08]],
    wing: [[.32,-1.0],[1.52,-.84],[2.25,-.28],[2.2,.56],[1.42,1.16],[.34,.8]],
    engineOffsets: [-.52,-.2,.2,.52], cockpit: [.56,.86,.38,-.48],
    hardpoints: [[.96,-.4],[1.48,-.22],[1.02,.42],[1.54,.58]], sensor: "array",
  },
  bastion: {
    silhouette: "armored-assault-gunship",
    sections: [[-1.98,.18,.16],[-1.24,.57,.38],[-.18,.72,.48],[.86,.68,.43],[1.5,.45,.31],[1.84,.12,.1]],
    wing: [[.34,-.96],[1.48,-.78],[2.16,-.12],[2.18,.62],[1.34,1.22],[.34,.84]],
    engineOffsets: [-.56,-.28,.28,.56], cockpit: [.6,.9,.42,-.44],
    hardpoints: [[.9,-.44],[1.38,-.2],[.94,.38],[1.48,.62]], sensor: "mast",
  },
  apep: {
    silhouette: "manta-stealth-hunter",
    sections: [[-2.4,.08,.08],[-1.42,.3,.22],[-.3,.47,.3],[.82,.4,.24],[1.52,.25,.16],[1.9,.04,.04]],
    wing: [[.24,-1.2],[1.12,-1.02],[2.08,-.5],[1.9,.02],[1.3,.84],[.58,.72],[.24,.38]],
    engineOffsets: [-.34,.34], cockpit: [.3,.7,.26,-.62],
    hardpoints: [[.75,-.36],[1.28,.18],[.82,.5]], ring: "split", sensor: "dish",
  },
  sekhmet: {
    silhouette: "bronze-siege-lance",
    sections: [[-2.38,.14,.13],[-1.42,.5,.34],[-.25,.66,.44],[.82,.58,.38],[1.5,.38,.26],[1.88,.08,.08]],
    wing: [[.3,-1.08],[1.5,-.82],[2.0,-.2],[1.78,.62],[1.22,1.08],[.32,.8]],
    engineOffsets: [-.46,-.16,.16,.46], cockpit: [.52,.88,.38,-.52],
    hardpoints: [[.8,-.38],[1.2,-.12],[.78,.36]], sensor: "array",
  },
  garuda: {
    silhouette: "phantom-swarm-chevron",
    sections: [[-2.4,.08,.08],[-1.48,.2,.15],[-.28,.29,.2],[.84,.23,.15],[1.62,.11,.09],[1.98,.03,.03]],
    wing: [[.2,-1.18],[1.25,-.92],[2.35,-.34],[1.9,.16],[1.48,.94],[.72,.68],[.2,.32]],
    engineOffsets: [-.28,.28], cockpit: [.26,.7,.25,-.7],
    hardpoints: [[.78,-.38],[1.3,-.12],[1.18,.5]], sensor: "mast",
  },
  vajra: {
    silhouette: "thunder-veil-heavy-interceptor",
    sections: [[-2.28,.11,.11],[-1.38,.38,.28],[-.24,.52,.36],[.84,.44,.29],[1.5,.3,.2],[1.88,.06,.06]],
    wing: [[.28,-1.12],[1.42,-.88],[2.05,-.46],[1.84,.38],[1.34,1.12],[.72,.88],[.28,.5]],
    engineOffsets: [-.42,-.14,.14,.42], cockpit: [.42,.82,.33,-.53],
    hardpoints: [[.82,-.34],[1.22,.02],[.92,.54]], sensor: "array",
  },
};

type Rgb = readonly [number, number, number];
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const shade = (color: Rgb, factor: number): Rgb =>
  [clamp01(color[0] * factor), clamp01(color[1] * factor), clamp01(color[2] * factor)];

/** Build one low-poly interleaved position/RGB buffer for Orbital WebGL2. */
export function buildOrbitalNativeShipGeometry(shipId: ShipId, factionColor: Rgb): Float32Array {
  const spec = ORBITAL_NATIVE_HULLS[shipId];
  const vertices: number[] = [];
  const body = shade(factionColor, .64);
  const dark = shade(factionColor, .34);
  const accent = shade(factionColor, 1.12);
  const canopy: Rgb = [.28, .78, .82];
  const addTriangle = (a: readonly number[], b: readonly number[], c: readonly number[], color: Rgb) => {
    for (const point of [a, b, c]) vertices.push(point[0]!, point[1]!, point[2]!, ...color);
  };
  const addQuad = (a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[], color: Rgb) => {
    addTriangle(a, b, c, color);
    addTriangle(a, c, d, color);
  };

  // Tapered fuselage with eight-sided cross sections.
  const rings = spec.sections.map(([z, width, height]) =>
    Array.from({ length: 8 }, (_, index) => {
      const angle = index * Math.PI / 4;
      return [Math.cos(angle) * width, Math.sin(angle) * height, z] as const;
    }));
  for (let row = 0; row < rings.length - 1; row++) {
    for (let side = 0; side < 8; side++) {
      const next = (side + 1) % 8;
      addQuad(rings[row]![side]!, rings[row + 1]![side]!, rings[row + 1]![next]!, rings[row]![next]!, body);
    }
  }

  // Individually swept left/right wing planforms.
  for (const sign of [-1, 1]) {
    const polygon = spec.wing.map(([x, z]) => [x * sign, z] as const);
    const centerX = polygon.reduce((sum, point) => sum + point[0], 0) / polygon.length;
    const centerZ = polygon.reduce((sum, point) => sum + point[1], 0) / polygon.length;
    for (let index = 0; index < polygon.length; index++) {
      const current = polygon[index]!;
      const next = polygon[(index + 1) % polygon.length]!;
      addTriangle([centerX, .045, centerZ], [current[0], .045, current[1]], [next[0], .045, next[1]], body);
      addTriangle([centerX, -.045, centerZ], [next[0], -.045, next[1]], [current[0], -.045, current[1]], dark);
    }
  }

  // Raised canopy, paired engine bells, and small role-specific hardpoint pods.
  const [cockpitWidth, cockpitLength, cockpitHeight, cockpitZ] = spec.cockpit;
  const canopyBase = [
    [-cockpitWidth, .11, cockpitZ - cockpitLength / 2],
    [cockpitWidth, .11, cockpitZ - cockpitLength / 2],
    [cockpitWidth * .72, .1, cockpitZ + cockpitLength / 2],
    [-cockpitWidth * .72, .1, cockpitZ + cockpitLength / 2],
  ] as const;
  const canopyTop = [0, .11 + cockpitHeight, cockpitZ] as const;
  for (let index = 0; index < canopyBase.length; index++) {
    addTriangle(canopyBase[index]!, canopyBase[(index + 1) % canopyBase.length]!, canopyTop, canopy);
  }
  for (const offset of spec.engineOffsets) {
    addCylinder(offset, -.04, 1.12, 1.1, .11 + (Math.abs(offset) < .2 ? .025 : 0), dark, accent, addTriangle, addQuad);
  }
  for (const [x, z] of spec.hardpoints) {
    for (const sign of [-1, 1]) addBox(x * sign, -.09, z, .13, .12, .52, accent, addTriangle, addQuad);
  }

  if (spec.sensor) {
    if (spec.sensor === "dish") {
      addTorus(0, .48, .46, .055, .16, accent, addTriangle, addQuad);
    } else {
      addBox(0, .3, .55, spec.sensor === "array" ? .52 : .12, .1, .18, accent, addTriangle, addQuad);
      if (spec.sensor === "mast") addBox(0, .44, .5, .07, .24, .07, accent, addTriangle, addQuad);
    }
  }
  if (spec.ring === "saucer") addTorus(0, .02, 1.16, .085, 0, accent, addTriangle, addQuad);
  if (spec.ring === "triple") {
    addTorus(0, .04, .72, .055, -.08, accent, addTriangle, addQuad);
    addTorus(0, .15, .95, .045, -.08, body, addTriangle, addQuad);
    addTorus(0, -.08, 1.18, .04, -.08, accent, addTriangle, addQuad);
  }
  if (spec.ring === "split") {
    addTorus(0, .03, .9, .055, -.15, body, addTriangle, addQuad, 0, Math.PI * .82);
    addTorus(0, .03, .9, .055, -.15, body, addTriangle, addQuad, Math.PI * 1.18, Math.PI * 2);
  }
  return new Float32Array(vertices);
}

function addBox(
  x: number, y: number, z: number, width: number, height: number, length: number, color: Rgb,
  triangle: (a: readonly number[], b: readonly number[], c: readonly number[], color: Rgb) => void,
  quad: (a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[], color: Rgb) => void,
) {
  const x0 = x - width / 2, x1 = x + width / 2;
  const y0 = y - height / 2, y1 = y + height / 2;
  const z0 = z - length / 2, z1 = z + length / 2;
  const a = [x0,y0,z0], b = [x1,y0,z0], c = [x1,y1,z0], d = [x0,y1,z0];
  const e = [x0,y0,z1], f = [x1,y0,z1], g = [x1,y1,z1], h = [x0,y1,z1];
  quad(a,b,c,d,color); quad(f,e,h,g,color); quad(e,a,d,h,color);
  quad(b,f,g,c,color); quad(d,c,g,h,color); quad(e,f,b,a,color);
  void triangle;
}

function addCylinder(
  x: number, y: number, z: number, length: number, radius: number, sideColor: Rgb, rimColor: Rgb,
  triangle: (a: readonly number[], b: readonly number[], c: readonly number[], color: Rgb) => void,
  quad: (a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[], color: Rgb) => void,
) {
  const sections = 9;
  for (let index = 0; index < sections; index++) {
    const a = index * Math.PI * 2 / sections, b = (index + 1) * Math.PI * 2 / sections;
    const p0 = [x + Math.cos(a) * radius, y + Math.sin(a) * radius, z];
    const p1 = [x + Math.cos(b) * radius, y + Math.sin(b) * radius, z];
    const p2 = [p1[0]!, p1[1]!, z + length];
    const p3 = [p0[0]!, p0[1]!, z + length];
    quad(p0,p1,p2,p3,sideColor);
    triangle([x,y,z],[p1[0]!,p1[1]!,z],[p0[0]!,p0[1]!,z],rimColor);
    triangle([x,y,z+length],[p0[0]!,p0[1]!,z+length],[p1[0]!,p1[1]!,z+length],rimColor);
  }
}

function addTorus(
  x: number, y: number, radius: number, tube: number, z: number, color: Rgb,
  triangle: (a: readonly number[], b: readonly number[], c: readonly number[], color: Rgb) => void,
  quad: (a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[], color: Rgb) => void,
  start = 0, end = Math.PI * 2,
) {
  const segments = Math.max(12, Math.ceil((end - start) * 12));
  const sides = 5;
  const point = (u: number, v: number) => [
    x + (radius + tube * Math.cos(v)) * Math.cos(u),
    y + (radius + tube * Math.cos(v)) * Math.sin(u),
    z + tube * Math.sin(v),
  ];
  for (let index = 0; index < segments; index++) {
    const u0 = start + (end - start) * index / segments;
    const u1 = start + (end - start) * (index + 1) / segments;
    for (let side = 0; side < sides; side++) {
      const v0 = side * Math.PI * 2 / sides, v1 = (side + 1) * Math.PI * 2 / sides;
      const a = point(u0,v0), b = point(u1,v0), c = point(u1,v1), d = point(u0,v1);
      quad(a,b,c,d,color);
    }
  }
  void triangle;
}
