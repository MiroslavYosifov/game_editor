import { createTileMap } from "../../../shared/factory";
import type { Scene, SceneObject } from "../../../shared/types";

export function sortByZIndex(objects: SceneObject[]): SceneObject[] {
  return [...objects].sort((a, b) => a.zIndex - b.zIndex);
}

export function cloneObject(object: SceneObject): SceneObject {
  return {
    ...object,
    sprite: object.sprite ? { ...object.sprite } : undefined,
    physics: {
      ...object.physics,
      gravity: { ...object.physics.gravity },
      velocity: { ...object.physics.velocity }
    }
  };
}

export function cloneScene(scene: Scene): Scene {
  return {
    ...scene,
    tileMap: {
      ...(scene.tileMap ?? createTileMap()),
      frames: [...(scene.tileMap?.frames ?? [])],
      layers: (scene.tileMap?.layers ?? createTileMap().layers).map((layer) => ({
        ...layer,
        tiles: layer.tiles.map((tile) => ({ ...tile }))
      }))
    },
    objects: scene.objects.map((object) => cloneObject(object))
  };
}

export function withUpdatedAt(scene: Scene, patch: Partial<Scene>): Scene {
  return { ...scene, ...patch, updatedAt: new Date().toISOString() };
}

export function clampSceneDimension(value: number): number {
  return Math.max(64, Math.min(8192, Math.round(value)));
}

export function removeObjects(scene: Scene, ids: Set<string>): Scene {
  return withUpdatedAt(scene, {
    objects: scene.objects.filter((object) => !ids.has(object.id))
  });
}

export function removeObject(scene: Scene, id: string): Scene {
  return withUpdatedAt(scene, {
    objects: scene.objects.filter((object) => object.id !== id)
  });
}

export function patchObject(scene: Scene, id: string, patch: Partial<SceneObject>): Scene {
  return withUpdatedAt(scene, {
    objects: sortByZIndex(scene.objects.map((object) => (object.id === id ? { ...object, ...patch } : object)))
  });
}

export function patchObjects(scene: Scene, patches: Array<{ id: string; patch: Partial<SceneObject> }>): Scene {
  const patchById = new Map(patches.map((item) => [item.id, item.patch]));
  return withUpdatedAt(scene, {
    objects: sortByZIndex(
      scene.objects.map((object) => {
        const patch = patchById.get(object.id);
        return patch ? { ...object, ...patch } : object;
      })
    )
  });
}
