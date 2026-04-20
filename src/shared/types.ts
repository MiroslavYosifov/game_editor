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
  sprite?: SpriteProperties;
  physics: PhysicsProperties;
}

export interface Scene {
  id: string;
  name: string;
  width: number;
  height: number;
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
  type: "image";
  storagePath: string;
  url: string;
  createdAt: string;
}
