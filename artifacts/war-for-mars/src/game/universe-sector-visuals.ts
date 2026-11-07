import * as THREE from "three";
import {
  nearbyUniverseSectors, type UniverseSectorAddress, type UniversePosition,
} from "./universe-sectors";

const ROCK_COLORS = [0x756656, 0x655a50, 0x867765, 0x505965] as const;

/** Low-poly, deterministic nearby scenery. The main game retains one scene and renderer. */
export function buildUniverseSectorNeighborhood(address: UniverseSectorAddress): THREE.Group {
  const root = new THREE.Group();
  root.name = `universe-sector-neighborhood:${address.x}:${address.y}:${address.z}`;
  const sectors = nearbyUniverseSectors(address);

  for (const sector of sectors) {
    if (sector.contents.kind === "origin") continue;
    const cell = new THREE.Group();
    cell.name = `sector:${sector.contents.key}`;
    cell.position.set(sector.offset.x, sector.offset.y, sector.offset.z);
    const material = new THREE.MeshStandardMaterial({
      color: ROCK_COLORS[sector.contents.seed % ROCK_COLORS.length],
      roughness: 0.94,
      metalness: 0.08,
    });
    for (const asteroid of sector.contents.asteroids) {
      const radius = asteroid.r;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), material);
      rock.position.set(asteroid.x, asteroid.y, asteroid.z);
      rock.scale.set(1.15, 0.78, 1);
      rock.rotation.set(
        (asteroid.seed % 31) / 31 * Math.PI,
        (asteroid.seed % 47) / 47 * Math.PI * 2,
        (asteroid.seed % 59) / 59 * Math.PI,
      );
      rock.name = `sector-asteroid:${sector.contents.key}:${asteroid.seed}`;
      cell.add(rock);
    }

    if (sector.contents.anomaly) {
      const anomaly = sector.contents.anomaly;
      const beacon = new THREE.Group();
      beacon.name = `sector-anomaly:${sector.contents.key}`;
      beacon.position.set(anomaly.x, anomaly.y, anomaly.z);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x77d9ff, transparent: true, opacity: 0.72, side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(15, 0.18, 8, 64), ringMaterial);
      ring.rotation.x = Math.PI / 2;
      beacon.add(ring);
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(3.4, 1),
        new THREE.MeshBasicMaterial({ color: 0xb1f2ff, transparent: true, opacity: 0.8 }),
      );
      beacon.add(core);
      const light = new THREE.PointLight(0x63c9ff, 8, 90, 2);
      beacon.add(light);
      cell.add(beacon);
    }
    root.add(cell);
  }
  return root;
}

export function setOriginSystemFrame(root: THREE.Group, address: UniverseSectorAddress, edge: number): boolean {
  const sector = [BigInt(address.x), BigInt(address.y), BigInt(address.z)];
  if (sector.some((axis) => axis < -1n || axis > 1n)) {
    root.visible = false;
    root.position.set(0, 0, 0);
    return false;
  }
  root.visible = true;
  const offset = sector.map((axis) => Number(axis) * edge);
  root.position.set(
    offset[0] ? -offset[0]! : 0,
    offset[1] ? -offset[1]! : 0,
    offset[2] ? -offset[2]! : 0,
  );
  return true;
}

export function disposeUniverseSectorNeighborhood(root: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}
