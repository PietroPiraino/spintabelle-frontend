import type { ThreeModule } from './diorama.types';
import type { SceneResources } from './disposable-scene';

/**
 * Pipeline GLTF condivisa (riusa il pattern dei diorami archiviati): carica un
 * .glb da /models/*.glb e traccia OGNI risorsa GPU nel registro anti-leak.
 * GLTFLoader è importato dinamicamente: resta fuori dal chunk del componente
 * host, arriva solo col chunk lazy di three.
 */
export interface LoadedModel {
  /** Radice del modello (gltf.scene). */
  root: import('three').Group;
  /** Clip di animazione incluse nel modello (qui i modelli sono statici → []). */
  clips: import('three').AnimationClip[];
}

export async function loadGltfModel(
  THREE: ThreeModule,
  res: SceneResources,
  url: string,
): Promise<LoadedModel> {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;

  root.traverse((obj) => {
    const mesh = obj as import('three').Mesh;
    if (!mesh.isMesh) return;
    res.track(mesh.geometry);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      res.track(material);
      const std = material as import('three').MeshStandardMaterial;
      for (const map of [
        std.map,
        std.normalMap,
        std.roughnessMap,
        std.metalnessMap,
        std.aoMap,
        std.emissiveMap,
      ]) {
        if (map) res.track(map);
      }
    }
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    // bounding non aggiornati dalle pose: meglio non cullare un singolo modello
    mesh.frustumCulled = false;
  });

  return { root, clips: gltf.animations };
}

/**
 * Recentra il modello all'origine e lo avvolge in un wrapper scalato così che
 * il lato più lungo misuri `targetSize` (unità scena). Rende il viewer robusto
 * a qualunque scala/pivot del .glb scaricato: niente tuning manuale per file.
 * Il wrapper è ciò che il chiamante anima (bob/ondeggio) e aggiunge alla scena.
 */
export function fitModel(
  THREE: ThreeModule,
  root: import('three').Object3D,
  targetSize: number,
): import('three').Group {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  root.position.sub(center); // centra la geometria sull'origine
  const wrapper = new THREE.Group();
  wrapper.add(root);
  wrapper.scale.setScalar(targetSize / maxDim);
  return wrapper;
}

/**
 * Vira di tono un materiale (per nome parziale, case-insensitive) moltiplicando
 * la sua texture per `colorHex`: la `baseColorFactor` resta ≈bianca nei modelli
 * Sketchfab, quindi impostare `color` tinge la mappa MANTENENDO i dettagli
 * (scaglie, ombre) — niente flat color. Usato per virare il pesce verso
 * l'arancio senza toccare occhi/riflessi (materiali diversi).
 */
export function tintMaterial(
  root: import('three').Object3D,
  match: string,
  colorHex: number,
): void {
  const target = match.toLowerCase();
  root.traverse((obj) => {
    const mesh = obj as import('three').Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const std = material as import('three').MeshStandardMaterial;
      if (std.name && std.name.toLowerCase().includes(target)) {
        std.color.setHex(colorHex);
        std.needsUpdate = true;
      }
    }
  });
}
