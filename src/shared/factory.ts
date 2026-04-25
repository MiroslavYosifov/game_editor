import type { ObjectType, PhysicsProperties, Scene, SceneObject } from "./types";

const DEFAULT_SCENE_WIDTH = 1280;
const DEFAULT_SCENE_HEIGHT = 720;
const DEFAULT_OBJECT_START = 120;
const DEFAULT_OBJECT_STEP = 16;

const defaultPhysics = (): PhysicsProperties => ({
  mode: "static",
  mass: 1,
  gravity: { x: 0, y: 9.8 },
  collision: true,
  velocity: { x: 0, y: 0 }
});

export const createId = (prefix: string): string =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;

export function createScene(name = "Untitled Scene"): Scene {
  return {
    id: createId("scene"),
    name,
    width: DEFAULT_SCENE_WIDTH,
    height: DEFAULT_SCENE_HEIGHT,
    objects: [],
    updatedAt: new Date().toISOString()
  };
}

export function createSceneObject(type: ObjectType, index: number): SceneObject {
  const baseSize = type === "circle" ? 96 : type === "text" ? 180 : 140;

  return {
    id: createId("object"),
    type,
    name: `${type[0].toUpperCase()}${type.slice(1)} ${index}`,
    x: DEFAULT_OBJECT_START + index * DEFAULT_OBJECT_STEP,
    y: DEFAULT_OBJECT_START + index * DEFAULT_OBJECT_STEP,
    width: baseSize,
    height: type === "text" ? 52 : baseSize,
    rotation: 0,
    zIndex: index,
    fill: type === "circle" ? "#2f80ed" : type === "text" ? "#111827" : "#16a34a",
    sprite:
      type === "sprite"
        ? {
            assetId: "",
            imageUrl: "",
            sheetUrl: "",
            animation: "",
            animationSpeed: 0.12,
            playing: true
          }
        : undefined,
    physics: defaultPhysics()
  };
}
