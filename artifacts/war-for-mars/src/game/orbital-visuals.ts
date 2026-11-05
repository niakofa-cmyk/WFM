import * as THREE from "three";
import { SHIPS, type ShipId } from "./ships";

// Vehicle-only procedural assets. Nose is +Z, matching Arena's existing models.
type Vec3Tuple = readonly [number, number, number];
type EngineMount = readonly [number, number, number, number];
type ArmorPanel = readonly [number, number, number, number, number, number];
type HullBlueprint = {
  silhouette: string;
  profile: readonly (readonly [number, number, number])[];
  wing: readonly (readonly [number, number])[];
  engines: readonly EngineMount[];
  guns: readonly Vec3Tuple[];
  missiles: readonly Vec3Tuple[];
  armor: readonly ArmorPanel[];
  sensor: "dish" | "mast" | "array" | "radial";
  ring?: "triple" | "split";
};

/**
 * Shared geometry language, individual airframes. Profile entries are
 * [longitudinal position, half-width, half-height]; wing outlines use x/z.
 * These are presentation meshes only and never define flight or hitbox data.
 */
const HULL_BLUEPRINTS: Record<ShipId, HullBlueprint> = {
  mandjet: {
    silhouette: "armored-vanguard",
    profile: [[-1.4, .26, .28], [-1.02, .52, .39], [-.48, .66, .43], [.18, .67, .4], [.82, .52, .31], [1.34, .3, .23], [1.68, .018, .025]],
    wing: [[.28, .55], [.9, .78], [2.04, .48], [1.92, -.64], [1.38, -1.04], [.32, -.58]],
    engines: [[-.46, -.06, -.98, .25], [.46, -.06, -.98, .25], [0, .08, -1.12, .18]],
    guns: [[-.48, -.14, .45], [.48, -.14, .45]], missiles: [[-.98, -.18, -.36], [.98, -.18, -.36]],
    armor: [[-.38, .29, .18, .34, .08, .34], [.38, .29, .18, .34, .08, .34], [-.84, .09, -.14, .38, .06, .28], [.84, .09, -.14, .38, .06, .28]],
    sensor: "array",
  },
  shakuna: {
    silhouette: "needle-interceptor",
    profile: [[-1.42, .12, .13], [-1.04, .22, .18], [-.34, .31, .23], [.42, .25, .18], [1.04, .14, .11], [1.6, .012, .02]],
    wing: [[.23, .74], [1.68, .48], [1.16, -.92], [.75, -.7], [.25, -.16]],
    engines: [[-.3, -.02, -1.04, .155], [.3, -.02, -1.04, .155]],
    guns: [[-.34, -.08, .5], [.34, -.08, .5]], missiles: [[-.87, -.14, -.27], [.87, -.14, -.27]],
    armor: [[-.3, .18, .16, .2, .05, .33], [.3, .18, .16, .2, .05, .33]],
    sensor: "mast",
  },
  sundara: {
    silhouette: "stealth-strike-wing",
    profile: [[-1.48, .2, .17], [-1.02, .45, .31], [-.4, .56, .35], [.28, .48, .29], [.94, .32, .2], [1.5, .024, .035]],
    wing: [[.26, .48], [1.48, .68], [1.92, .08], [1.64, -.78], [1.03, -.94], [.27, -.43]],
    engines: [[-.62, -.1, -.86, .22], [.62, -.1, -.86, .22]],
    guns: [[-.43, -.15, .44], [.43, -.15, .44], [0, .08, .82]], missiles: [[-.82, -.18, -.38], [-.35, -.2, -.58], [.35, -.2, -.58], [.82, -.18, -.38]],
    armor: [[-.32, .28, -.02, .28, .07, .42], [.32, .28, -.02, .28, .07, .42], [0, -.24, -.55, .72, .1, .34]],
    sensor: "dish",
  },
  tripura: {
    silhouette: "trinity-ring-support",
    profile: [[-1.34, .2, .19], [-.96, .4, .29], [-.38, .54, .3], [.12, .45, .26], [.78, .32, .2], [1.46, .018, .025]],
    wing: [[.24, .48], [1.34, .82], [1.72, .28], [1.32, -.62], [.86, -.82], [.24, -.48]],
    engines: [[-.55, -.2, -.82, .13], [.55, -.2, -.82, .13], [-.55, .2, -.82, .13], [.55, .2, -.82, .13]],
    guns: [[-.4, -.12, .42], [.4, -.12, .42]], missiles: [[-.94, -.18, -.28], [.94, -.18, -.28]],
    armor: [[-.3, .26, .04, .3, .06, .32], [.3, .26, .04, .3, .06, .32]],
    sensor: "radial", ring: "triple",
  },
  duskbreaker: {
    silhouette: "precision-dart",
    profile: [[-1.4, .17, .16], [-1.02, .31, .24], [-.42, .4, .29], [.22, .34, .24], [.92, .22, .16], [1.58, .014, .024]],
    wing: [[.22, .74], [.82, .36], [1.68, -.76], [.98, -.56], [.3, -.25]],
    engines: [[-.35, -.04, -1.02, .18], [.35, -.04, -1.02, .18]],
    guns: [[-.4, -.1, .56], [.4, -.1, .56]], missiles: [[-.77, -.15, -.26], [.77, -.15, -.26]],
    armor: [[-.28, .23, .12, .22, .05, .38], [.28, .23, .12, .22, .05, .38]],
    sensor: "array",
  },
  sentinel: {
    silhouette: "armored-escort-wing",
    profile: [[-1.35, .28, .25], [-.98, .5, .37], [-.38, .58, .42], [.3, .57, .38], [.84, .42, .29], [1.42, .17, .15], [1.65, .014, .02]],
    wing: [[.3, .56], [1.18, 1.02], [1.92, .72], [1.82, -.65], [1.14, -1.04], [.3, -.58]],
    engines: [[-.72, -.08, -.88, .18], [.72, -.08, -.88, .18], [-.72, .17, -.67, .12], [.72, .17, -.67, .12]],
    guns: [[-.58, -.16, .44], [.58, -.16, .44], [-1.08, -.12, .08], [1.08, -.12, .08]],
    missiles: [[-.98, -.2, -.36], [.98, -.2, -.36]],
    armor: [[-.4, .32, .04, .42, .1, .42], [.4, .32, .04, .42, .1, .42], [-1.18, .1, -.02, .3, .08, .34], [1.18, .1, -.02, .3, .08, .34]],
    sensor: "array",
  },
  splitter: {
    silhouette: "split-ring-hunter",
    profile: [[-1.34, .18, .17], [-.96, .32, .25], [-.34, .43, .29], [.24, .39, .26], [.92, .22, .16], [1.48, .018, .024]],
    wing: [[.24, .45], [1.38, .72], [1.88, .02], [1.42, -.72], [.88, -.82], [.24, -.44]],
    engines: [[0, -.04, -1.08, .23], [-.86, -.1, -.56, .11], [.86, -.1, -.56, .11]],
    guns: [[-.44, -.1, .48], [.44, -.1, .48]], missiles: [[-.9, -.16, -.27], [.9, -.16, -.27]],
    armor: [[-.32, .23, .02, .26, .06, .38], [.32, .23, .02, .26, .06, .38]],
    sensor: "dish", ring: "split",
  },
  glide: {
    silhouette: "swept-raider",
    profile: [[-1.5, .12, .13], [-1.04, .22, .18], [-.46, .29, .21], [.18, .28, .18], [.88, .17, .12], [1.56, .012, .02]],
    wing: [[.21, .82], [1.94, .3], [1.18, -1.18], [.68, -.82], [.22, -.31]],
    engines: [[-.3, -.02, -1.05, .145], [.3, -.02, -1.05, .145]],
    guns: [[-.34, -.08, .53], [.34, -.08, .53]], missiles: [[-.8, -.13, -.22], [.8, -.13, -.22]],
    armor: [[-.26, .17, .16, .16, .045, .34], [.26, .17, .16, .16, .045, .34]],
    sensor: "mast",
  },
};

function makeFuselage(profile: HullBlueprint["profile"]) {
  const sides = 10;
  const positions: number[] = [];
  const indices: number[] = [];
  for (const [z, rx, ry] of profile) {
    for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2;
      positions.push(Math.cos(angle) * rx, Math.sin(angle) * ry, z);
    }
  }
  for (let ring = 0; ring < profile.length - 1; ring++) {
    for (let side = 0; side < sides; side++) {
      const a = ring * sides + side;
      const b = ring * sides + (side + 1) % sides;
      const c = (ring + 1) * sides + side;
      const d = (ring + 1) * sides + (side + 1) % sides;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildOrbitalShip(id: ShipId) {
  const group = new THREE.Group();
  const ship = SHIPS[id];
  const blueprint = HULL_BLUEPRINTS[id];
  const accord = ship.faction === "accord";
  const factionColor = accord ? 0xe6a34c : 0x57b9ee;
  const body = new THREE.MeshStandardMaterial({
    color: accord ? 0x88603b : 0x8297a5, roughness: accord ? .33 : .4, metalness: .76,
  });
  const armor = new THREE.MeshStandardMaterial({ color: accord ? 0x3b2b22 : 0x273541, roughness: .43, metalness: .68 });
  const trim = new THREE.MeshStandardMaterial({ color: accord ? 0xe7bf7e : 0xb8cbd5, roughness: .28, metalness: .74 });
  const marking = new THREE.MeshStandardMaterial({ color: factionColor, emissive: factionColor, emissiveIntensity: .22, roughness: .34, metalness: .54 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x143c4d, emissive: accord ? 0x84451e : 0x276480, emissiveIntensity: .45, metalness: .7, roughness: .12,
  });
  const hot = new THREE.MeshStandardMaterial({
    color: accord ? 0xffb64f : 0x8ddcfa, emissive: accord ? 0xff7d20 : 0x38b9ed, emissiveIntensity: 2.8, roughness: .2,
  });
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, at: Vec3Tuple) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...at);
    mesh.userData.role = name;
    mesh.userData.baseE = (material as THREE.MeshStandardMaterial).emissiveIntensity ?? 0;
    group.add(mesh);
    return mesh;
  };

  const fuse = add("fuselage", makeFuselage(blueprint.profile), body, [0, 0, 0]);
  fuse.userData.silhouette = blueprint.silhouette;

  // The cockpit, sensor fit and stern structure vary with each airframe.
  const canopy = add("cockpit-canopy", new THREE.SphereGeometry(.23, 12, 8), glass, [0, .2, .69]);
  canopy.scale.set(ship.role === "Support" || ship.role === "Vanguard" ? 1.18 : .78, .7, 1.75);
  if (blueprint.sensor === "dish") {
    const stem = add("sensor-stem", new THREE.CylinderGeometry(.025, .04, .24, 6), trim, [0, .34, -.16]);
    stem.rotation.x = .18;
    const dish = add("sensor-dish", new THREE.CylinderGeometry(.12, .055, .045, 12), trim, [0, .47, -.12]);
    dish.rotation.x = Math.PI / 2;
  } else if (blueprint.sensor === "mast") {
    add("sensor-mast", new THREE.CylinderGeometry(.018, .04, .42, 6), trim, [0, .31, -.38]);
    add("sensor-beacon", new THREE.SphereGeometry(.075, 8, 6), marking, [0, .53, -.38]);
  } else if (blueprint.sensor === "array") {
    add("sensor-array-left", new THREE.BoxGeometry(.22, .055, .3), trim, [-.28, .27, -.2]);
    add("sensor-array-right", new THREE.BoxGeometry(.22, .055, .3), trim, [.28, .27, -.2]);
    add("sensor-beacon", new THREE.SphereGeometry(.06, 8, 6), marking, [0, .34, -.17]);
  } else {
    add("radial-sensor", new THREE.TorusGeometry(.15, .027, 6, 18), marking, [0, .14, -.28]);
    add("radial-core", new THREE.SphereGeometry(.08, 8, 6), trim, [0, .14, -.28]);
  }

  const wingShape = new THREE.Shape();
  blueprint.wing.forEach(([x, z], index) => {
    if (index === 0) wingShape.moveTo(x, z);
    else wingShape.lineTo(x, z);
  });
  wingShape.closePath();
  for (const side of [-1, 1] as const) {
    const plate = add(
      side < 0 ? "port-wing" : "starboard-wing",
      new THREE.ExtrudeGeometry(wingShape, { depth: .075, bevelEnabled: true, bevelThickness: .018, bevelSize: .022, bevelSegments: 1 }),
      body,
      [0, -.035, 0],
    );
    plate.geometry.translate(0, 0, -.0375);
    plate.scale.x = side;
    plate.rotation.x = Math.PI / 2;

    // Modular armor breaks up the wings and gives the faction silhouette detail.
    for (const [x, y, z, sx, sy, sz] of blueprint.armor) {
      if (Math.sign(x || side) !== side) continue;
      const panel = add(side < 0 ? "port-armor-plate" : "starboard-armor-plate", new THREE.BoxGeometry(sx, sy, sz), armor, [x, y, z]);
      panel.rotation.y = side * .12;
    }

    const stripe = add(
      side < 0 ? "port-faction-marking" : "starboard-faction-marking",
      new THREE.BoxGeometry(.22, .018, .13),
      marking,
      [side * 1.22, .025, -.26],
    );
    stripe.rotation.y = side * -.22;
  }

  // Engine count and placement are role-specific: twin, central, distributed,
  // and four-pod escort layouts all remain within the original fighter envelope.
  for (const [index, [x, y, z, radius]] of blueprint.engines.entries()) {
    const engine = add(`engine-housing-${index + 1}`, new THREE.CylinderGeometry(radius * .78, radius, .64, 10), armor, [x, y, z]);
    engine.rotation.x = Math.PI / 2;
    const collar = add(`engine-collar-${index + 1}`, new THREE.TorusGeometry(radius * .72, .028, 6, 12), trim, [x, y, z - .34]);
    const exhaust = add(`engine-exhaust-${index + 1}`, new THREE.CircleGeometry(radius * .58, 10), hot, [x, y, z - .35]);
    exhaust.rotation.y = Math.PI;
    exhaust.name = index === 0 ? "exhaust" : `exhaust-${index + 1}`;
    const nozzle = add(`engine-nozzle-${index + 1}`, new THREE.SphereGeometry(radius * .38, 8, 6), hot, [x, y, z - .47]);
    nozzle.scale.z = 1.8;
    collar.userData.engineIndex = index;
  }

  for (const [index, [x, y, z]] of blueprint.guns.entries()) {
    const mount = add(`weapon-hardpoint-${index + 1}`, new THREE.BoxGeometry(.12, .09, .17), armor, [x, y, z - .16]);
    mount.rotation.y = x < 0 ? -.12 : .12;
    const barrel = add(`primary-cannon-${index + 1}`, new THREE.CylinderGeometry(.034, .058, .48, 8), trim, [x, y, z]);
    barrel.rotation.x = Math.PI / 2;
  }
  for (const [index, [x, y, z]] of blueprint.missiles.entries()) {
    const rail = add(`missile-rail-${index + 1}`, new THREE.BoxGeometry(.16, .065, .38), armor, [x, y - .08, z]);
    rail.rotation.y = x < 0 ? -.08 : .08;
    const missile = add(`missile-round-${index + 1}`, new THREE.CylinderGeometry(.045, .075, .42, 8), trim, [x, y - .16, z + .04]);
    missile.rotation.x = Math.PI / 2;
    add(`missile-nose-${index + 1}`, new THREE.ConeGeometry(.052, .15, 8), marking, [x, y - .16, z + .325]);
  }

  // Three unobtrusive docking points make the hull read as a spacecraft, not
  // only a flying silhouette. They are visual fittings, not collision gear.
  for (const [index, [x, y, z]] of [[-.36, -.3, -.5], [.36, -.3, -.5], [0, -.27, -1.05] as Vec3Tuple].entries()) {
    add(`docking-strut-${index + 1}`, new THREE.CylinderGeometry(.025, .04, .2, 6), trim, [x, y, z]);
    add(`docking-pad-${index + 1}`, new THREE.BoxGeometry(.18, .035, .22), armor, [x, y - .11, z]);
  }

  if (blueprint.ring === "triple") {
    for (let index = 0; index < 3; index++) {
      add(`trinity-ring-${index + 1}`, new THREE.TorusGeometry(.62 + index * .22, .035, 6, 32), index === 1 ? marking : trim, [0, .02 + index * .055, -.18]);
    }
  } else if (blueprint.ring === "split") {
    const portArc = add("split-ring-port", new THREE.TorusGeometry(.82, .052, 7, 32, Math.PI * 1.62), marking, [-.02, .04, -.22]);
    const starboardArc = add("split-ring-starboard", new THREE.TorusGeometry(.82, .052, 7, 32, Math.PI * 1.62), trim, [.02, -.04, -.22]);
    starboardArc.rotation.z = Math.PI;
    portArc.rotation.z = Math.PI * .04;
  }

  group.userData.asset = `wfm-orbital-${id}`;
  group.userData.silhouette = blueprint.silhouette;
  group.userData.faction = ship.faction;
  group.userData.designLanguage = accord ? "accord-energy-forged" : "ussf-modular-military";
  group.userData.engineCount = blueprint.engines.length;
  group.userData.weaponHardpoints = blueprint.guns.length;
  group.userData.missileRails = blueprint.missiles.length;
  group.userData.sensorFit = blueprint.sensor;
  return group;
}

function planetTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas texture support is required for the orbital environment.");
  ctx.fillStyle = "#9a4f30"; ctx.fillRect(0, 0, 1024, 512);
  let seed = 1938;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 14000; i++) {
    const x = random() * 1024; const y = random() * 512; const r = 1 + random() * 22;
    ctx.fillStyle = i % 3 ? "rgba(41,20,15,.035)" : "rgba(232,161,101,.045)";
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.7, r * .55, -.15, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 180; i++) {
    const x = random() * 1024; const y = 25 + random() * 462; const r = 1 + random() * 9;
    ctx.strokeStyle = "rgba(244,181,121,.25)"; ctx.lineWidth = .8;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.4, r, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(50,25,15,.17)"; ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

export function addOrbitalEnvironment(scene: THREE.Scene) {
  const texture = planetTexture();
  const bump = texture.clone();
  bump.colorSpace = THREE.NoColorSpace;
  bump.needsUpdate = true;
  const mars = new THREE.Mesh(new THREE.SphereGeometry(65, 80, 48), new THREE.MeshStandardMaterial({ map: texture, bumpMap: bump, bumpScale: .6, roughness: .96, metalness: 0 }));
  mars.position.set(-100, 21, -200); mars.rotation.z = .3;
  scene.add(mars);
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(66.3, 64, 40), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
    fragmentShader: `varying vec3 n;varying vec3 v;void main(){float f=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(.65,.22,.08,f*.6);}`,
  }));
  atmosphere.position.copy(mars.position); scene.add(atmosphere);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 24), new THREE.MeshStandardMaterial({ color: 0x77716d, roughness: 1 }));
  moon.position.set(100, 50, -210); scene.add(moon);
  const dust = new THREE.BufferGeometry();
  const positions = new Float32Array(1800 * 3);
  for (let i = 0; i < 1800; i++) {
    const a = i * 2.399963; const y = 1 - (i / 1799) * 2; const radius = Math.sqrt(1 - y * y);
    positions.set([Math.cos(a) * radius * 410, y * 410, Math.sin(a) * radius * 410], i * 3);
  }
  dust.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Points(dust, new THREE.PointsMaterial({ color: 0xc0d4e1, size: .45, sizeAttenuation: true })));
  const station = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({ color: 0x68717a, metalness: .8, roughness: .45 });
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(9 + i * 2, .25, 12, 96), silver);
    ring.rotation.x = i * .12; station.add(ring);
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const module = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 5, 20), silver);
    module.position.set(Math.sin(a) * 11, Math.cos(a) * 11, 0); module.rotation.z = -a;
    station.add(module);
  }
  station.position.set(65, 17, -110); station.rotation.y = -.4; scene.add(station);
  return { textures: [texture, bump] };
}

export function orbitalRock(radius: number, seed: number) {
  const geometry = new THREE.SphereGeometry(radius, 48, 32);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i); const y = positions.getY(i); const z = positions.getZ(i);
    const noise = 1 + .12 * Math.sin(x * 2 + seed) * Math.cos(z * 3 + y) + .08 * Math.sin(z * 4 - y * 3);
    positions.setXYZ(i, x * noise, y * noise * .82, z * noise);
  }
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x62564b, roughness: .92, metalness: .12 }));
}
