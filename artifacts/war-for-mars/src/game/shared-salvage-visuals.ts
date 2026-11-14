import * as THREE from "./three-flight-runtime";
import type { SalvageContact } from "@workspace/orbital-sim";

/** A physical equipment crate, kept in the same rebased frame as ships. */
export function createSalvageVisuals(scene: THREE.Scene) {
  const meshes = new Map<string, THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>>();
  function clear() {
    for (const mesh of meshes.values()) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    meshes.clear();
  }
  return {
    clear,
    update(contacts: readonly SalvageContact[], localize: (p: SalvageContact["position"]) =>
      SalvageContact["position"] | null) {
      const ids = new Set(contacts.map(p => p.id));
      for (const [id, mesh] of meshes) if (!ids.has(id)) {
        scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); meshes.delete(id);
      }
      for (const contact of contacts) {
        let mesh = meshes.get(contact.id);
        if (!mesh) {
          mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 4),
            new THREE.MeshBasicMaterial({ color: 0xdca958, wireframe: true }));
          meshes.set(contact.id, mesh);
          scene.add(mesh);
        }
        const position = localize(contact.position);
        mesh.visible = position !== null;
        if (position) mesh.position.set(position.x, position.y, position.z);
        mesh.material.color.setHex(contact.recoverable ? 0x68e6cf : 0xdca958);
      }
    },
  };
}
