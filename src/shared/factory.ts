import type { ObjectType, PhysicsProperties, Scene, SceneObject, TileMap } from "./types";

const DEFAULT_SCENE_WIDTH = 1280;
const DEFAULT_SCENE_HEIGHT = 720;
const DEFAULT_GRID_SIZE = 32;
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

export function createTileMap(): TileMap {
  return {
    tilesetAssetId: "",
    imageUrl: "",
    sheetUrl: "",
    frames: [],
    brushFrameName: "",
    activeLayer: "visual",
    showCollisionOverlay: true,
    layers: [
      { id: "visual", name: "Visual", visible: true, tiles: [] },
      { id: "collision", name: "Collision", visible: true, tiles: [] }
    ]
  };
}

export function ensureSceneDefaults(scene: Scene | (Omit<Scene, "tileMap"> & { tileMap?: TileMap })): Scene {
  const fallbackTileMap = createTileMap();
  const tileMap = scene.tileMap
    ? {
        ...fallbackTileMap,
        ...scene.tileMap,
        layers: [
          { ...fallbackTileMap.layers[0], ...(scene.tileMap.layers?.find((layer) => layer.id === "visual") ?? {}) },
          { ...fallbackTileMap.layers[1], ...(scene.tileMap.layers?.find((layer) => layer.id === "collision") ?? {}) }
        ]
      }
    : fallbackTileMap;

  const frameLookup = new Map(tileMap.frames.map((frame) => [frame.name, frame]));
  tileMap.layers = tileMap.layers.map((layer) => ({
    ...layer,
    tiles: layer.tiles.map((tile) => ({
      ...tile,
      assetId: tile.assetId ?? tileMap.tilesetAssetId,
      imageUrl: tile.imageUrl ?? tileMap.imageUrl,
      frame: tile.frame ?? frameLookup.get(tile.frameName) ?? { name: tile.frameName, x: 0, y: 0, w: 32, h: 32 }
    }))
  }));

  return {
    ...scene,
    gridSize: Math.max(4, Math.min(256, Math.round(scene.gridSize ?? DEFAULT_GRID_SIZE))),
    tileMap
  };
}

export function createScene(name = "Untitled Scene"): Scene {
  return ensureSceneDefaults({
    id: createId("scene"),
    name,
    width: DEFAULT_SCENE_WIDTH,
    height: DEFAULT_SCENE_HEIGHT,
    gridSize: DEFAULT_GRID_SIZE,
    objects: [],
    updatedAt: new Date().toISOString()
  });
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
    locked: false,
    hidden: false,
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
