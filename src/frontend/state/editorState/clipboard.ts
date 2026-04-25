import { createId } from "../../../shared/factory";
import type { Scene, SceneObject } from "../../../shared/types";
import { cloneObject } from "./sceneMutations";

export function createClipboard(objects: SceneObject[]): SceneObject[] {
  return objects.map((object) => cloneObject(object));
}

export function createPastedObjects(
  clipboardObjects: SceneObject[],
  scene: Scene,
  snapValue: (value: number) => number,
  snapToGrid: boolean,
  gridSize: number
): SceneObject[] {
  const offset = snapToGrid ? gridSize : 20;
  const maxZ = scene.objects.reduce((max, object) => Math.max(max, object.zIndex), 0);
  return clipboardObjects.map((object, index) => ({
    ...object,
    id: createId("object"),
    name: `${object.name} Copy`,
    x: snapValue(object.x + offset),
    y: snapValue(object.y + offset),
    zIndex: maxZ + index + 1
  }));
}
