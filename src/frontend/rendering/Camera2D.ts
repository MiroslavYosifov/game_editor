import type { Point2D, Rect2D } from "./geometry";

export interface CameraState {
  scale: number;
  x: number;
  y: number;
}

export class Camera2D {
  private state: CameraState = { scale: 1, x: 0, y: 0 };

  fitToViewport(viewportWidth: number, viewportHeight: number, sceneWidth: number, sceneHeight: number, padding = 24): void {
    const width = Math.max(1, viewportWidth);
    const height = Math.max(1, viewportHeight);
    const scale = Math.min((width - padding * 2) / sceneWidth, (height - padding * 2) / sceneHeight);
    this.state.scale = Math.max(0.1, Math.min(1, scale));
    this.state.x = Math.round((width - sceneWidth * this.state.scale) / 2);
    this.state.y = Math.round((height - sceneHeight * this.state.scale) / 2);
  }

  toScenePoint(point: Point2D): Point2D {
    return {
      x: (point.x - this.state.x) / this.state.scale,
      y: (point.y - this.state.y) / this.state.scale
    };
  }

  toViewportRect(rect: Rect2D): Rect2D {
    return {
      x: rect.x * this.state.scale + this.state.x,
      y: rect.y * this.state.scale + this.state.y,
      width: rect.width * this.state.scale,
      height: rect.height * this.state.scale
    };
  }

  toWorldPixels(value: number): number {
    return value / this.state.scale;
  }

  getState(): CameraState {
    return { ...this.state };
  }
}
