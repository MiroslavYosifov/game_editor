import type { AssetSummary, ObjectType, PhysicsMode, Scene, SceneObject } from "../../shared/types";

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

const spriteObject = (
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
  asset?: AssetSummary
): SceneObject => ({
  ...object(id, "sprite", name, x, y, width, height, "#64748b", zIndex, true, "dynamic"),
  sprite: {
    assetId: asset?.id ?? "",
    imageUrl: asset?.url ?? "",
    sheetUrl: asset?.sheetUrl ?? "",
    animation: "",
    animationSpeed: 0.16,
    playing: true
  }
});

export function createExamplePlatformScene(heroAsset?: AssetSummary): Scene {
  return {
    id: "example-snake-scene",
    name: "Sprite Maze Scene",
    width: 1280,
    height: 720,
    updatedAt: new Date().toISOString(),
    objects: [
      object("maze-bg", "rectangle", "Dark Background", 0, 0, 1280, 720, "#0f172a", 1, false),
      object("maze-board", "rectangle", "Gray Arena", 128, 72, 880, 576, "#d1d5db", 2, false),
      object("maze-shadow", "rectangle", "Arena Shadow", 152, 96, 880, 576, "#020617", 1, false),
      object("maze-border-top", "rectangle", "Top Wall", 128, 72, 880, 28, "#020617", 10),
      object("maze-border-bottom", "rectangle", "Bottom Wall", 128, 620, 880, 28, "#020617", 11),
      object("maze-border-left", "rectangle", "Left Wall", 128, 72, 28, 576, "#020617", 12),
      object("maze-border-right", "rectangle", "Right Wall", 980, 72, 28, 576, "#020617", 13),
      object("maze-wall-1", "rectangle", "Upper Platform", 264, 188, 304, 28, "#374151", 20),
      object("maze-wall-2", "rectangle", "Central Pillar", 632, 188, 28, 252, "#374151", 21),
      object("maze-wall-3", "rectangle", "Lower Platform", 300, 500, 356, 28, "#374151", 22),
      object("maze-wall-4", "rectangle", "Right Block", 764, 352, 148, 28, "#374151", 23),
      object("maze-goal", "rectangle", "Exit Gate", 892, 520, 64, 80, "#f8fafc", 24, false),
      spriteObject("maze-hero-sprite", "Hero Sprite", 220, 452, 92, 104, 40, heroAsset),
      object("maze-patrol-1", "circle", "Patrol Enemy 1", 520, 284, 46, 46, "#ef4444", 41, true, "dynamic"),
      object("maze-patrol-2", "circle", "Patrol Enemy 2", 804, 220, 46, 46, "#f97316", 42, true, "dynamic"),
      object("maze-coin-1", "circle", "Coin 1", 360, 128, 28, 28, "#facc15", 50, false),
      object("maze-coin-2", "circle", "Coin 2", 720, 128, 28, 28, "#facc15", 51, false),
      object("maze-coin-3", "circle", "Coin 3", 848, 456, 28, 28, "#facc15", 52, false),
      object("maze-ui-panel", "rectangle", "HUD Panel", 1048, 72, 168, 132, "#020617", 60, false),
      object("maze-title-text", "text", "Sprite Maze", 1072, 100, 120, 34, "#f8fafc", 61, false),
      object("maze-goal-text", "text", "Goal: reach the gate", 1064, 148, 136, 36, "#cbd5e1", 62, false)
    ]
  };
}
