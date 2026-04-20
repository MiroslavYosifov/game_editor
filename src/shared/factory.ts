import type { ObjectType, PhysicsProperties, Scene, SceneObject } from "./types";

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
    width: 1280,
    height: 720,
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
    x: 120 + index * 16,
    y: 120 + index * 16,
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
