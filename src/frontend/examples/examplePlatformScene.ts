import type { ObjectType, PhysicsMode, Scene, SceneObject } from "../../shared/types";

const object = (
  id: string,
  type: ObjectType,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  zIndex: number,
  collision = true,
  mode: PhysicsMode = "static"
): SceneObject => ({
  id,
  type,
  name,
  x,
  y,
  width,
  height,
  rotation: 0,
  zIndex,
  fill,
  physics: {
    mode,
    mass: 1,
    gravity: { x: 0, y: 0 },
    collision,
    velocity: { x: 0, y: 0 }
  }
});

export function createExamplePlatformScene(): Scene {
  return {
    id: "example-snake-scene",
    name: "Snake Game Scene",
    width: 1280,
    height: 720,
    updatedAt: new Date().toISOString(),
    objects: [
      object("snake-bg", "rectangle", "Dark Background", 0, 0, 1280, 720, "#111827", 1, false),
      object("snake-board", "rectangle", "Gray Playfield", 160, 80, 800, 560, "#d1d5db", 2, false),
      object("snake-border-top", "rectangle", "Top Wall", 160, 80, 800, 32, "#020617", 10),
      object("snake-border-bottom", "rectangle", "Bottom Wall", 160, 608, 800, 32, "#020617", 11),
      object("snake-border-left", "rectangle", "Left Wall", 160, 80, 32, 560, "#020617", 12),
      object("snake-border-right", "rectangle", "Right Wall", 928, 80, 32, 560, "#020617", 13),
      object("snake-maze-wall-1", "rectangle", "Maze Wall 1", 320, 208, 288, 32, "#374151", 20),
      object("snake-maze-wall-2", "rectangle", "Maze Wall 2", 672, 208, 32, 224, "#374151", 21),
      object("snake-maze-wall-3", "rectangle", "Maze Wall 3", 352, 480, 320, 32, "#374151", 22),
      object("snake-head", "rectangle", "Snake Head", 608, 336, 48, 48, "#86efac", 30, true, "dynamic"),
      object("snake-eye-left", "circle", "Snake Eye Left", 618, 348, 8, 8, "#020617", 31, false),
      object("snake-eye-right", "circle", "Snake Eye Right", 642, 348, 8, 8, "#020617", 32, false),
      object("snake-body-1", "rectangle", "Snake Body 1", 560, 336, 48, 48, "#22c55e", 33, true, "dynamic"),
      object("snake-body-2", "rectangle", "Snake Body 2", 512, 336, 48, 48, "#16a34a", 34, true, "dynamic"),
      object("snake-body-3", "rectangle", "Snake Body 3", 464, 336, 48, 48, "#15803d", 35, true, "dynamic"),
      object("snake-body-4", "rectangle", "Snake Body 4", 416, 336, 48, 48, "#166534", 36, true, "dynamic"),
      object("snake-body-5", "rectangle", "Snake Body 5", 416, 384, 48, 48, "#15803d", 37, true, "dynamic"),
      object("snake-body-6", "rectangle", "Snake Body 6", 416, 432, 48, 48, "#16a34a", 38, true, "dynamic"),
      object("snake-food", "circle", "Food", 800, 336, 40, 40, "#ef4444", 40, false),
      object("snake-score-panel", "rectangle", "Score Panel", 1000, 80, 160, 96, "#020617", 50, false),
      object("snake-score-text", "text", "Score 0", 1024, 112, 112, 36, "#f8fafc", 51, false)
    ]
  };
}
