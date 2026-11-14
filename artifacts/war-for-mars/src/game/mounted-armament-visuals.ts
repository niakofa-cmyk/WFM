import * as THREE from "./three-flight-runtime";
import { equipmentDefinition, isVisibleArmamentActor, type VisibleArmamentActor } from "@workspace/orbital-sim";

export const MAX_ARMAMENT_MESHES_PER_SHIP = 24;
export const ARMAMENT_DETAIL_DISTANCE = 250;
type Point = readonly [number, number, number];

/** Original, low-poly military fittings. Never changes physics or inventory. */
export function createMountedArmamentVisuals(model: THREE.Group, shipId: string) {
  const stock = model.children.filter(c => c.name.startsWith("primary-cannon-") ||
    c.name.startsWith("missile-round-") || c.name.startsWith("missile-nose-"))
    .map(object => ({ object, visible: object.visible }));
  const gun = model.getObjectByName("primary-cannon-1")?.position.clone() ?? new THREE.Vector3(0, -.3, .55);
  const missile = model.getObjectByName("missile-rail-1")?.position.clone() ?? new THREE.Vector3(-.8, -.25, -.1);
  let root: THREE.Group | null = null;
  let last: VisibleArmamentActor | null = null;
  let signature = "";
  let disposed = false;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials: THREE.MeshStandardMaterial[] = [];
  const palette = () => {
    if (!materials.length) {
      const color = model.userData.faction === "accord" ? 0xf1ac56 : 0x7bbde2;
      materials.push(
        new THREE.MeshStandardMaterial({ color: 0x26303a, metalness: .8, roughness: .48 }),
        new THREE.MeshStandardMaterial({ color: 0xa3afb6, metalness: .85, roughness: .35 }),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .4, metalness: .5, roughness: .4 }),
      );
    }
    return materials;
  };
  function clear() {
    if (root) model.remove(root);
    root = null;
    for (const geometry of geometries) geometry.dispose();
    geometries.clear();
    for (const entry of stock) entry.object.visible = entry.visible;
    last = null; signature = "";
  }
  function update(record: VisibleArmamentActor | null, visible = true) {
    if (disposed) return;
    if (!record || record.shipId !== shipId) { if (root || last) clear(); return; }
    if (record === last) { if (root) root.visible = visible; return; }
    if (!isVisibleArmamentActor(record)) { clear(); return; }
    const key = JSON.stringify(record.mounts.slice().sort((a, b) => a.hardpointId.localeCompare(b.hardpointId)));
    if (key === signature) { last = record; if (root) root.visible = visible; return; }
    clear();
    last = record; signature = key;
    if (!record.mounts.length) return;
    root = new THREE.Group();
    root.name = "server-issued-armament";
    root.userData.presentationOnly = true;
    root.visible = visible;
    model.add(root);
    const [body, steel, accent] = palette();
    let meshCount = 0;
    for (const item of record.mounts) {
      const def = equipmentDefinition(item.equipmentId)!;
      const mount = new THREE.Group();
      mount.name = `hardpoint:${item.hardpointId}`;
      mount.userData.equipmentId = def.id;
      mount.userData.hardpointId = item.hardpointId;
      const scale = 1 + (def.size - 1) * .3;
      mount.scale.setScalar(scale);
      const add = (geometry: THREE.BufferGeometry, material: THREE.Material, point: Point) => {
        if (++meshCount > MAX_ARMAMENT_MESHES_PER_SHIP)
          throw new Error("Mounted armament template exceeded its render budget.");
        geometries.add(geometry);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...point);
        mount.add(mesh);
        return mesh;
      };
      const box = (dimensions: Point, point: Point, material = body!) =>
        add(new THREE.BoxGeometry(...dimensions), material, point);
      const tube = (radius: number, length: number, point: Point) => {
        const mesh = add(new THREE.CylinderGeometry(radius, radius * 1.15, length, 6), steel!, point);
        mesh.rotation.x = Math.PI / 2;
        return mesh;
      };
      if (def.kind === "primary") {
        mount.position.copy(gun);
        box([.19, .17, .3], [0, 0, -.12]);
        if (def.id === "railgun") {
          box([.045, .07, .85], [-.075, 0, .35], steel);
          box([.045, .07, .85], [.075, 0, .35], steel);
        } else if (def.id === "rotary-gun") {
          for (const [x, y] of [[-.06, -.035], [.06, -.035], [0, .065]])
            tube(.027, .62, [x!, y!, .27]);
        } else tube(.047, .58, [0, 0, .25]);
      } else if (def.kind === "secondary") {
        mount.position.copy(missile);
        box([.2, .09, .44], [0, .04, -.08]);
        if (def.id === "rocket") {
          tube(.065, .55, [-.075, -.07, .1]);
          tube(.065, .55, [.075, -.07, .1]);
        } else {
          tube(def.id === "torpedo" ? .12 : .075, .65, [0, -.09, .1]);
          const nose = add(new THREE.ConeGeometry(def.id === "torpedo" ? .12 : .075, .22, 6), accent!, [0, -.09, .53]);
          nose.rotation.x = Math.PI / 2;
        }
      } else if (def.kind === "special") {
        mount.position.set(0, .36, -.4);
        box([.25, .17, .34], [0, 0, 0]);
        add(new THREE.TorusGeometry(.13, .025, 5, 10), accent!, [0, .1, .05]);
      } else if (def.kind === "defensive") {
        mount.position.set(-missile.x, missile.y, missile.z - .25);
        box([.26, .15, .3], [0, 0, 0]);
        box([.21, .035, .22], [0, .09, 0], def.id === "hardened-decoys" ? steel : accent);
      } else {
        const index = Number(item.hardpointId.split("-")[1]) - 1;
        mount.position.set(index % 2 ? .32 : -.32, .32, index < 2 ? -.12 : -.68);
        box(def.id === "armor" ? [.3, .05, .4] : [.22, .12, .24], [0, 0, 0]);
        if (def.id === "sensors" || def.id === "comms")
          box([.035, .24, .16], [0, .16, 0], steel);
        else if (def.id !== "armor") box([.16, .025, .14], [0, .08, 0], accent);
      }
      root.add(mount);
    }
    const primary = record.mounts.some(item => equipmentDefinition(item.equipmentId)?.kind === "primary");
    const secondary = record.mounts.some(item => equipmentDefinition(item.equipmentId)?.kind === "secondary");
    for (const entry of stock) {
      if (entry.object.name.startsWith("primary-cannon-") ? primary : secondary) entry.object.visible = false;
    }
    root.userData.meshCount = meshCount;
  }
  return {
    update, clear,
    hide() { if (root) root.visible = false; },
    dispose() {
      if (disposed) return;
      clear(); materials.forEach(material => material.dispose()); materials.length = 0; disposed = true;
    },
    get root() { return root; },
  };
}
