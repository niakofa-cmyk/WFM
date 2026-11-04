import * as THREE from "three";
import { SHIPS, type ShipId } from "./ships";

// Vehicle-only procedural assets. Nose is +Z, matching Arena's existing models.
export function buildOrbitalShip(id: ShipId) {
  const group = new THREE.Group();
  const accord = SHIPS[id].faction === "accord";
  const heavy = id === "mandjet" || id === "sentinel";
  const narrow = id === "sundara" || id === "glide";
  const body = new THREE.MeshStandardMaterial({ color: accord ? 0x9d7343 : 0x9eafbc, roughness: .36, metalness: .82 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x17232b, roughness: .57, metalness: .65 });
  const trim = new THREE.MeshStandardMaterial({ color: accord ? 0xead4a0 : 0xd8dfe2, roughness: .3, metalness: .72 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x143c4d, emissive: 0x276480, emissiveIntensity: .35, metalness: .7, roughness: .12 });
  const hot = new THREE.MeshStandardMaterial({ color: accord ? 0xffb64f : 0x8ddcfa, emissive: accord ? 0xff7d20 : 0x38b9ed, emissiveIntensity: 2.8, roughness: .2 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.userData.baseE = (material as THREE.MeshStandardMaterial).emissiveIntensity;
    group.add(mesh);
    return mesh;
  };
  const profiles = [new THREE.Vector2(.07, -1.35), new THREE.Vector2(.28, -1.22), new THREE.Vector2(.37, -.7), new THREE.Vector2(.32, .2), new THREE.Vector2(.19, .92), new THREE.Vector2(.02, 1.7)];
  const fuse = add(new THREE.LatheGeometry(profiles, 32), body, 0, 0, 0);
  fuse.rotation.x = Math.PI / 2;
  fuse.scale.set(heavy ? 1.5 : 1, 1, .68);
  const cockpit = add(new THREE.SphereGeometry(.25, 24, 16), glass, 0, .26, .65);
  cockpit.scale.set(.75, .7, 2.25);
  const wing = new THREE.Shape();
  wing.moveTo(.25, .75); wing.lineTo(narrow ? 1.08 : heavy ? 2.1 : 1.7, -.65);
  wing.lineTo(narrow ? .9 : 1.65, -1.05); wing.lineTo(.3, -.55); wing.closePath();
  for (const sign of [-1, 1]) {
    const plate = add(new THREE.ExtrudeGeometry(wing, { depth: .07, bevelEnabled: true, bevelThickness: .025, bevelSize: .035, bevelSegments: 2, steps: 1 }), body, 0, .01, 0);
    plate.rotation.x = Math.PI / 2;
    plate.scale.x = sign;
    // Wing channels, exposed intake louvers and inset armor plates establish scale.
    for (let index = 0; index < 6; index++) {
      const channel = add(new THREE.BoxGeometry(.28, .018, .045), dark, sign * (.52 + index * .13), .09, -.42 - index * .07);
      channel.rotation.y = sign * .32;
    }
    const engine = add(new THREE.CylinderGeometry(.19, .23, .95, 24), dark, sign * .53, 0, -.78);
    engine.rotation.x = Math.PI / 2;
    for (let index = 0; index < 3; index++) {
      const collar = add(new THREE.TorusGeometry(.2, .025, 8, 24), trim, sign * .53, 0, -1.05 - index * .11);
      collar.rotation.z = index * .2;
    }
    add(new THREE.CircleGeometry(.15, 24), hot, sign * .53, 0, -1.3).rotation.y = Math.PI;
    const plume = add(new THREE.SphereGeometry(.13, 16, 12), hot, sign * .53, 0, -1.5);
    plume.scale.z = 2.6;
    plume.name = sign === 1 ? "exhaust" : "exhaust-port";
    const gun = add(new THREE.CylinderGeometry(.035, .065, .85, 12), trim, sign * .78, -.07, .45);
    gun.rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(.07, .04, .2), hot, sign * .85, .1, -.9);
    const fin = add(new THREE.BoxGeometry(.045, .38, .48), body, sign * .5, .2, -.8);
    fin.rotation.z = sign * -.28;
  }
  for (let index = 0; index < 8; index++) {
    add(new THREE.BoxGeometry(.25, .025, .035), dark, 0, .255 - index * .01, .1 - index * .15);
  }
  if (id === "tripura" || id === "splitter") {
    for (let index = 0; index < (id === "tripura" ? 3 : 1); index++) {
      const ring = add(new THREE.TorusGeometry(1.12 + index * .22, .045, 12, 64), trim, 0, 0, -.1);
      ring.rotation.x = Math.PI / 2 + index * .16;
    }
  }
  group.userData.asset = `wfm-orbital-${id}`;
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
