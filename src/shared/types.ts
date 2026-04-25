export type ObjectType = "rectangle" | "circle" | "sprite" | "text";

export type PhysicsMode = "static" | "dynamic";

export interface Vector2 {
  x: number;
  y: number;
}

export interface PhysicsProperties {
  mode: PhysicsMode;
  mass: number;
  gravity: Vector2;
  collision: boolean;
  velocity: Vector2;
}

export interface SpriteProperties {
  assetId: string;
  imageUrl: string;
  sheetUrl: string;
  animation: string;
  animationSpeed: number;
  playing: boolean;
}

export interface TileFrame {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TileCell {
  col: number;
  row: number;
  frameName: string;
}

export interface TileLayer {
  id: "visual" | "collision";
  name: string;
  visible: boolean;
  tiles: TileCell[];
}

export interface TileMap {
  tilesetAssetId: string;
  imageUrl: string;
  sheetUrl: string;
  frames: TileFrame[];
  brushFrameName: string;
  activeLayer: "visual" | "collision";
  showCollisionOverlay: boolean;
  layers: TileLayer[];
}

export interface SceneObject {
  id: string;
  type: ObjectType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  fill: string;
  locked?: boolean;
  hidden?: boolean;
  sprite?: SpriteProperties;
  physics: PhysicsProperties;
}

export interface Scene {
  id: string;
  name: string;
  width: number;
  height: number;
  tileMap: TileMap;
  objects: SceneObject[];
  updatedAt: string;
}

export interface SceneSummary {
  id: string;
  name: string;
  objectCount: number;
  updatedAt: string;
}

export interface AssetSummary {
  id: string;
  name: string;
  type: "image" | "spritesheet";
  storagePath: string;
  url: string;
  sheetUrl?: string;
  frameNames?: string[];
  createdAt: string;
}
