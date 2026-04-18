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
    gravity: { x: 0, y: 9.8 },
    collision,
    velocity: { x: 0, y: 0 }
  }
});

export function createExamplePlatformScene(): Scene {
  return {
    id: "example-platform-scene",
    name: "Example Platform Scene",
    width: 1280,
    height: 720,
    updatedAt: new Date().toISOString(),
    objects: [
      object("example-sky", "rectangle", "Sky Background", 0, 0, 1280, 720, "#bde7ff", 1, false),
      object("example-sun", "circle", "Sun", 1040, 64, 96, 96, "#facc15", 2, false),
      object("example-cloud-1", "circle", "Cloud Puff 1", 120, 92, 86, 52, "#ffffff", 3, false),
      object("example-cloud-2", "circle", "Cloud Puff 2", 180, 76, 110, 66, "#ffffff", 4, false),
      object("example-cloud-3", "circle", "Cloud Puff 3", 250, 98, 90, 50, "#ffffff", 5, false),
      object("example-ground", "rectangle", "Ground", 0, 624, 1280, 96, "#22c55e", 10),
      object("example-dirt", "rectangle", "Dirt Base", 0, 674, 1280, 46, "#8b5a2b", 11, false),
      object("example-platform-1", "rectangle", "Lower Platform", 270, 510, 220, 28, "#0f766e", 20),
      object("example-platform-2", "rectangle", "Middle Platform", 585, 420, 210, 28, "#0f766e", 21),
      object("example-platform-3", "rectangle", "High Platform", 890, 315, 190, 28, "#0f766e", 22),
      object("example-player-body", "rectangle", "Player Body", 112, 552, 48, 72, "#2563eb", 30, true, "dynamic"),
      object("example-player-head", "circle", "Player Head", 108, 508, 56, 56, "#93c5fd", 31, true, "dynamic"),
      object("example-enemy-1", "circle", "Rolling Enemy", 486, 576, 48, 48, "#ef4444", 35, true, "dynamic"),
      object("example-enemy-2", "circle", "Platform Enemy", 675, 372, 42, 42, "#ef4444", 36, true, "dynamic"),
      object("example-coin-1", "circle", "Coin 1", 326, 458, 32, 32, "#f59e0b", 40, false),
      object("example-coin-2", "circle", "Coin 2", 402, 458, 32, 32, "#f59e0b", 41, false),
      object("example-coin-3", "circle", "Coin 3", 650, 366, 32, 32, "#f59e0b", 42, false),
      object("example-coin-4", "circle", "Coin 4", 948, 258, 32, 32, "#f59e0b", 43, false),
      object("example-goal-post", "rectangle", "Goal Post", 1150, 476, 24, 148, "#7c3aed", 50),
      object("example-goal-orb", "circle", "Goal Orb", 1132, 430, 60, 60, "#a78bfa", 51, false)
    ]
  };
}
