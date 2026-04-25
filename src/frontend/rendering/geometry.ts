import type { SceneObject } from "../../shared/types";

export interface Point2D {
  x: number;
  y: number;
}

export interface Rect2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function toLocalPoint(object: SceneObject, point: Point2D): Point2D {
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;
  const radians = (-object.rotation * Math.PI) / 180;
  const dx = point.x - cx;
  const dy = point.y - cy;
  return {
    x: dx * Math.cos(radians) - dy * Math.sin(radians),
    y: dx * Math.sin(radians) + dy * Math.cos(radians)
  };
}

export function containsPoint(object: SceneObject, point: Point2D): boolean {
  const local = toLocalPoint(object, point);
  return local.x >= -object.width / 2 && local.y >= -object.height / 2 && local.x <= object.width / 2 && local.y <= object.height / 2;
}

export function getWorldBounds(object: SceneObject): Rect2D {
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;
  const radians = (object.rotation * Math.PI) / 180;
  const corners = [
    { x: -object.width / 2, y: -object.height / 2 },
    { x: object.width / 2, y: -object.height / 2 },
    { x: -object.width / 2, y: object.height / 2 },
    { x: object.width / 2, y: object.height / 2 }
  ].map((corner) => ({
    x: cx + corner.x * Math.cos(radians) - corner.y * Math.sin(radians),
    y: cy + corner.x * Math.sin(radians) + corner.y * Math.cos(radians)
  }));
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY
  };
}

export function intersectsRect(object: SceneObject, rect: Rect2D): boolean {
  const bounds = getWorldBounds(object);
  return (
    bounds.x <= rect.x + rect.width &&
    bounds.x + bounds.width >= rect.x &&
    bounds.y <= rect.y + rect.height &&
    bounds.y + bounds.height >= rect.y
  );
}

export function isNear(point: Point2D, target: Point2D, radius: number): boolean {
  return Math.abs(point.x - target.x) <= radius && Math.abs(point.y - target.y) <= radius;
}
