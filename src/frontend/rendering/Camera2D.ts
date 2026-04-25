import type { Point2D, Rect2D } from "./geometry";

export interface CameraState {
  scale: number;
  x: number;
  y: number;
}

export class Camera2D {
  private baseState: CameraState = { scale: 1, x: 0, y: 0 };
  private zoom = 1;
  private pan = { x: 0, y: 0 };

  fitToViewport(viewportWidth: number, viewportHeight: number, sceneWidth: number, sceneHeight: number, padding = 24): void {
    const width = Math.max(1, viewportWidth);
    const height = Math.max(1, viewportHeight);
    const scale = Math.min((width - padding * 2) / sceneWidth, (height - padding * 2) / sceneHeight);
    this.baseState.scale = Math.max(0.1, Math.min(1, scale));
    this.baseState.x = Math.round((width - sceneWidth * this.baseState.scale) / 2);
    this.baseState.y = Math.round((height - sceneHeight * this.baseState.scale) / 2);
  }

  toScenePoint(point: Point2D): Point2D {
    const state = this.getState();
    return {
      x: (point.x - state.x) / state.scale,
      y: (point.y - state.y) / state.scale
    };
  }

  toViewportRect(rect: Rect2D): Rect2D {
    const state = this.getState();
    return {
      x: rect.x * state.scale + state.x,
      y: rect.y * state.scale + state.y,
      width: rect.width * state.scale,
      height: rect.height * state.scale
    };
  }

  toWorldPixels(value: number): number {
    return value / this.getState().scale;
  }

  zoomAt(viewportPoint: Point2D, factor: number): void {
    const before = this.toScenePoint(viewportPoint);
    const nextZoom = Math.max(0.5, Math.min(8, this.zoom * factor));
    if (nextZoom === this.zoom) return;

    this.zoom = nextZoom;
    const nextScale = this.baseState.scale * this.zoom;
    this.pan.x = viewportPoint.x - before.x * nextScale - this.baseState.x;
    this.pan.y = viewportPoint.y - before.y * nextScale - this.baseState.y;
  }

  panBy(deltaX: number, deltaY: number): void {
    this.pan.x += deltaX;
    this.pan.y += deltaY;
  }

  resetView(): void {
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
  }

  frameRect(viewportWidth: number, viewportHeight: number, rect: Rect2D, padding = 64): void {
    const width = Math.max(1, viewportWidth);
    const height = Math.max(1, viewportHeight);
    const rectWidth = Math.max(1, rect.width);
    const rectHeight = Math.max(1, rect.height);
    const targetScale = Math.min((width - padding * 2) / rectWidth, (height - padding * 2) / rectHeight);
    this.zoom = Math.max(0.5, Math.min(8, targetScale / this.baseState.scale));

    const scale = this.baseState.scale * this.zoom;
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    this.pan.x = width / 2 - centerX * scale - this.baseState.x;
    this.pan.y = height / 2 - centerY * scale - this.baseState.y;
  }

  getState(): CameraState {
    return {
      scale: this.baseState.scale * this.zoom,
      x: this.baseState.x + this.pan.x,
      y: this.baseState.y + this.pan.y
    };
  }
}
