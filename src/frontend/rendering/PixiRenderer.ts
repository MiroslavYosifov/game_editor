import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import type { SceneObject } from "../../shared/types";
import { EditorState } from "../state/EditorState";

export type SelectionControl =
  | { type: "resize"; handle: ResizeHandle };

export type ResizeHandle = "nw" | "ne" | "sw" | "se";

export class PixiRenderer {
  private readonly app: Application;
  private readonly viewportBackground = new Graphics();
  private readonly world = new Container();
  private readonly handleSize = 12;
  private camera = { scale: 1, x: 0, y: 0 };

  constructor(
    private readonly host: HTMLElement,
    private readonly state: EditorState
  ) {
    this.app = new Application({
      antialias: true,
      autoDensity: true,
      backgroundColor: 0xf4f7fb,
      resolution: window.devicePixelRatio || 1
    });

    this.app.stage.sortableChildren = true;
    this.world.sortableChildren = true;
    this.viewportBackground.zIndex = -2000;
    this.app.stage.addChild(this.viewportBackground);
    this.app.stage.addChild(this.world);
    this.view.setAttribute("aria-label", "2D scene WebGL viewport");
    this.view.setAttribute("role", "img");
    this.host.appendChild(this.view);

    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  get view(): HTMLCanvasElement {
    return this.app.view as HTMLCanvasElement;
  }

  resize(): void {
    this.app.renderer.resize(this.host.clientWidth, this.host.clientHeight);
    this.render();
  }

  toScenePoint(point: { x: number; y: number }): { x: number; y: number } {
    return {
      x: (point.x - this.camera.x) / this.camera.scale,
      y: (point.y - this.camera.y) / this.camera.scale
    };
  }

  toViewportRect(rect: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number } {
    return {
      x: rect.x * this.camera.scale + this.camera.x,
      y: rect.y * this.camera.scale + this.camera.y,
      width: rect.width * this.camera.scale,
      height: rect.height * this.camera.scale
    };
  }

  render(): void {
    this.world.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.updateCamera();
    this.drawViewportBackground();
    this.drawBackground();
    this.drawSceneBounds();
    for (const object of this.state.scene.objects) this.drawObject(object);

    const selectedObjects = this.state.selectedObjects;
    for (const object of selectedObjects) this.drawSelection(object, selectedObjects.length === 1);
  }

  hitTest(point: { x: number; y: number }): SceneObject | null {
    const sorted = [...this.state.scene.objects].sort((a, b) => b.zIndex - a.zIndex);
    return sorted.find((object) => this.containsPoint(object, point)) ?? null;
  }

  hitTestRect(rect: { x: number; y: number; width: number; height: number }): SceneObject[] {
    return this.state.scene.objects.filter((object) => this.intersectsRect(object, rect));
  }

  hitSelectionControl(point: { x: number; y: number }): SelectionControl | null {
    if (this.state.selectedObjects.length !== 1) return null;
    const selected = this.state.selectedObject;
    if (!selected) return null;

    const local = this.toLocalPoint(selected, point);
    const halfWidth = selected.width / 2;
    const halfHeight = selected.height / 2;
    const padding = 5;

    const handles: Array<{ handle: ResizeHandle; x: number; y: number }> = [
      { handle: "nw", x: -halfWidth - padding, y: -halfHeight - padding },
      { handle: "ne", x: halfWidth + padding, y: -halfHeight - padding },
      { handle: "sw", x: -halfWidth - padding, y: halfHeight + padding },
      { handle: "se", x: halfWidth + padding, y: halfHeight + padding }
    ];

    const hit = handles.find((handle) => this.isNear(local, handle, this.toWorldPixels(this.handleSize) / 2));
    return hit ? { type: "resize", handle: hit.handle } : null;
  }

  private containsPoint(object: SceneObject, point: { x: number; y: number }): boolean {
    const local = this.toLocalPoint(object, point);
    return local.x >= -object.width / 2 && local.y >= -object.height / 2 && local.x <= object.width / 2 && local.y <= object.height / 2;
  }

  private intersectsRect(object: SceneObject, rect: { x: number; y: number; width: number; height: number }): boolean {
    const bounds = this.getWorldBounds(object);
    return (
      bounds.x <= rect.x + rect.width &&
      bounds.x + bounds.width >= rect.x &&
      bounds.y <= rect.y + rect.height &&
      bounds.y + bounds.height >= rect.y
    );
  }

  private getWorldBounds(object: SceneObject): { x: number; y: number; width: number; height: number } {
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

  private toLocalPoint(object: SceneObject, point: { x: number; y: number }): { x: number; y: number } {
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

  private isNear(point: { x: number; y: number }, target: { x: number; y: number }, radius: number): boolean {
    return Math.abs(point.x - target.x) <= radius && Math.abs(point.y - target.y) <= radius;
  }

  private drawBackground(): void {
    const width = this.state.scene.width;
    const height = this.state.scene.height;
    const grid = new Graphics();
    grid.zIndex = -1000;
    grid.beginFill(0xf4f7fb);
    grid.drawRect(0, 0, width, height);
    grid.endFill();
    const gridSize = this.state.gridSize;

    for (let x = 0; x < width; x += gridSize) {
      grid.lineStyle(x % (gridSize * 4) === 0 ? 2 : 1, x % (gridSize * 4) === 0 ? 0xc7d2de : 0xd8e0ea, 1);
      grid.moveTo(x, 0);
      grid.lineTo(x, height);
    }

    for (let y = 0; y < height; y += gridSize) {
      grid.lineStyle(y % (gridSize * 4) === 0 ? 2 : 1, y % (gridSize * 4) === 0 ? 0xc7d2de : 0xd8e0ea, 1);
      grid.moveTo(0, y);
      grid.lineTo(width, y);
    }

    this.world.addChild(grid);
  }

  private drawViewportBackground(): void {
    this.viewportBackground.clear();
    this.viewportBackground.beginFill(0xe2e8f0);
    this.viewportBackground.drawRect(0, 0, this.host.clientWidth, this.host.clientHeight);
    this.viewportBackground.endFill();
  }

  private updateCamera(): void {
    const padding = 24;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    const scale = Math.min((width - padding * 2) / this.state.scene.width, (height - padding * 2) / this.state.scene.height);
    this.camera.scale = Math.max(0.1, Math.min(1, scale));
    this.camera.x = Math.round((width - this.state.scene.width * this.camera.scale) / 2);
    this.camera.y = Math.round((height - this.state.scene.height * this.camera.scale) / 2);
    this.world.position.set(this.camera.x, this.camera.y);
    this.world.scale.set(this.camera.scale);
  }

  private drawSceneBounds(): void {
    const bounds = new Graphics();
    bounds.zIndex = -999;
    bounds.lineStyle(2, 0x1f2937, 1);
    bounds.drawRect(0, 0, this.state.scene.width, this.state.scene.height);
    this.world.addChild(bounds);
  }

  private drawObject(object: SceneObject): void {
    const display = new Container();
    display.position.set(object.x + object.width / 2, object.y + object.height / 2);
    display.rotation = (object.rotation * Math.PI) / 180;
    display.zIndex = object.zIndex;

    const shape = new Graphics();
    shape.lineStyle(2, object.physics.collision ? 0x111827 : 0x9ca3af, 1);

    if (object.type === "text") {
      const outline = new Graphics();
      outline.lineStyle(2, object.physics.collision ? 0x111827 : 0x9ca3af, 1);
      outline.drawRect(-object.width / 2, -object.height / 2, object.width, object.height);
      display.addChild(outline);

      const label = new Text(
        object.name,
        new TextStyle({
          fill: this.toColorNumber(object.fill),
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 18,
          fontWeight: "600"
        })
      );
      label.anchor.set(0.5);
      label.style.wordWrap = true;
      label.style.wordWrapWidth = object.width;
      display.addChild(label);
    } else if (object.type === "circle") {
      shape.beginFill(this.toColorNumber(object.fill));
      shape.drawEllipse(0, 0, object.width / 2, object.height / 2);
      shape.endFill();
      display.addChild(shape);
    } else {
      shape.beginFill(this.toColorNumber(object.fill));
      shape.drawRect(-object.width / 2, -object.height / 2, object.width, object.height);
      shape.endFill();
      display.addChild(shape);
    }

    this.world.addChild(display);
  }

  private drawSelection(object: SceneObject, showHandles: boolean): void {
    const selection = new Graphics();
    selection.position.set(object.x + object.width / 2, object.y + object.height / 2);
    selection.rotation = (object.rotation * Math.PI) / 180;
    selection.zIndex = 100000;
    const padding = 5;
    const handleSize = this.toWorldPixels(this.handleSize);
    const halfHandle = handleSize / 2;
    selection.lineStyle(this.toWorldPixels(2), 0xef4444, 1);
    selection.drawRect(-object.width / 2 - padding, -object.height / 2 - padding, object.width + padding * 2, object.height + padding * 2);

    if (!showHandles) {
      this.world.addChild(selection);
      return;
    }

    selection.beginFill(0xffffff);
    selection.lineStyle(this.toWorldPixels(2), 0xef4444, 1);
    for (const handle of [
      { x: -object.width / 2 - padding, y: -object.height / 2 - padding },
      { x: object.width / 2 + padding, y: -object.height / 2 - padding },
      { x: -object.width / 2 - padding, y: object.height / 2 + padding },
      { x: object.width / 2 + padding, y: object.height / 2 + padding }
    ]) {
      selection.drawRect(handle.x - halfHandle, handle.y - halfHandle, handleSize, handleSize);
    }
    selection.endFill();

    this.world.addChild(selection);
  }

  private toColorNumber(value: string): number {
    const normalized = value.replace("#", "");
    const parsed = Number.parseInt(normalized, 16);
    return Number.isFinite(parsed) ? parsed : 0x16a34a;
  }

  private toWorldPixels(value: number): number {
    return value / this.camera.scale;
  }
}
