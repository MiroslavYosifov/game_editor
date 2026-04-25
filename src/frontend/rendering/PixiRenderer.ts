import { AnimatedSprite, Application, Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";
import type { SceneObject } from "../../shared/types";
import { EditorState } from "../state/EditorState";
import { Camera2D } from "./Camera2D";
import { containsPoint, getWorldBounds, intersectsRect, isNear, toLocalPoint } from "./geometry";
import { SelectionOverlayRenderer } from "./SelectionOverlayRenderer";
import { SpriteAssetCache } from "./SpriteAssetCache";

export type SelectionControl =
  | { type: "resize"; handle: ResizeHandle };

export type ResizeHandle = "nw" | "ne" | "sw" | "se";

export class PixiRenderer {
  private readonly app: Application;
  private readonly viewportBackground = new Graphics();
  private readonly world = new Container();
  private readonly handleSize = 12;
  private readonly spriteAssetCache = new SpriteAssetCache();
  private readonly selectionOverlayRenderer = new SelectionOverlayRenderer();
  private readonly camera = new Camera2D();

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
    return this.camera.toScenePoint(point);
  }

  toViewportRect(rect: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number } {
    return this.camera.toViewportRect(rect);
  }

  zoomAt(point: { x: number; y: number }, factor: number): void {
    this.camera.zoomAt(point, factor);
    this.render();
  }

  zoomBy(factor: number): void {
    this.zoomAt(
      {
        x: this.host.clientWidth / 2,
        y: this.host.clientHeight / 2
      },
      factor
    );
  }

  panBy(deltaX: number, deltaY: number): void {
    this.camera.panBy(deltaX, deltaY);
    this.render();
  }

  resetView(): void {
    this.camera.resetView();
    this.render();
  }

  frameObjects(objects: SceneObject[]): boolean {
    if (objects.length === 0) return false;

    const bounds = objects.map((object) => getWorldBounds(object));
    const minX = Math.min(...bounds.map((bound) => bound.x));
    const minY = Math.min(...bounds.map((bound) => bound.y));
    const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width));
    const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height));

    this.updateCamera();
    this.camera.frameRect(this.host.clientWidth, this.host.clientHeight, {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    });
    this.render();
    return true;
  }

  render(): void {
    this.world.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.updateCamera();
    this.drawViewportBackground();
    this.drawBackground();
    this.drawSceneBounds();
    for (const object of this.state.scene.objects) {
      if (object.hidden) continue;
      this.drawObject(object);
    }

    const selectedObjects = this.state.selectedObjects.filter((object) => !object.hidden);
    for (const object of selectedObjects) this.drawSelection(object, selectedObjects.length === 1);
  }

  hitTest(point: { x: number; y: number }): SceneObject | null {
    const sorted = [...this.state.scene.objects].filter((object) => !object.hidden && !object.locked).sort((a, b) => b.zIndex - a.zIndex);
    return sorted.find((object) => containsPoint(object, point)) ?? null;
  }

  hitTestRect(rect: { x: number; y: number; width: number; height: number }): SceneObject[] {
    return this.state.scene.objects.filter((object) => !object.hidden && !object.locked && intersectsRect(object, rect));
  }

  hitSelectionControl(point: { x: number; y: number }): SelectionControl | null {
    if (this.state.selectedObjects.length !== 1) return null;
    const selected = this.state.selectedObject;
    if (!selected || selected.hidden || selected.locked) return null;

    const local = toLocalPoint(selected, point);
    const halfWidth = selected.width / 2;
    const halfHeight = selected.height / 2;
    const padding = 5;

    const handles: Array<{ handle: ResizeHandle; x: number; y: number }> = [
      { handle: "nw", x: -halfWidth - padding, y: -halfHeight - padding },
      { handle: "ne", x: halfWidth + padding, y: -halfHeight - padding },
      { handle: "sw", x: -halfWidth - padding, y: halfHeight + padding },
      { handle: "se", x: halfWidth + padding, y: halfHeight + padding }
    ];

    const hit = handles.find((handle) => isNear(local, handle, this.toWorldPixels(this.handleSize) / 2));
    return hit ? { type: "resize", handle: hit.handle } : null;
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
    this.camera.fitToViewport(this.host.clientWidth, this.host.clientHeight, this.state.scene.width, this.state.scene.height, 24);
    const cameraState = this.camera.getState();
    this.world.position.set(cameraState.x, cameraState.y);
    this.world.scale.set(cameraState.scale);
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
    } else if (object.type === "sprite") {
      const spriteDisplay = this.createSpriteDisplay(object);
      if (spriteDisplay) display.addChild(spriteDisplay);
      else display.addChild(this.createSpritePlaceholder(object));
    } else {
      shape.beginFill(this.toColorNumber(object.fill));
      shape.drawRect(-object.width / 2, -object.height / 2, object.width, object.height);
      shape.endFill();
      display.addChild(shape);
    }

    this.world.addChild(display);
  }

  private createSpritePlaceholder(object: SceneObject): Graphics {
    const placeholder = new Graphics();
    const left = -object.width / 2;
    const top = -object.height / 2;
    const dash = 10;
    const gap = 6;

    placeholder.lineStyle(2, 0x64748b, 1);
    this.drawDashedLine(placeholder, left, top, left + object.width, top, dash, gap);
    this.drawDashedLine(placeholder, left + object.width, top, left + object.width, top + object.height, dash, gap);
    this.drawDashedLine(placeholder, left + object.width, top + object.height, left, top + object.height, dash, gap);
    this.drawDashedLine(placeholder, left, top + object.height, left, top, dash, gap);

    placeholder.lineStyle(1, 0x94a3b8, 0.85);
    this.drawDashedLine(placeholder, left, top, left + object.width, top + object.height, dash, gap);
    this.drawDashedLine(placeholder, left + object.width, top, left, top + object.height, dash, gap);
    return placeholder;
  }

  private drawDashedLine(graphics: Graphics, x1: number, y1: number, x2: number, y2: number, dash: number, gap: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    const stepX = dx / length;
    const stepY = dy / length;
    let distance = 0;

    while (distance < length) {
      const start = distance;
      const end = Math.min(distance + dash, length);
      graphics.moveTo(x1 + stepX * start, y1 + stepY * start);
      graphics.lineTo(x1 + stepX * end, y1 + stepY * end);
      distance += dash + gap;
    }
  }

  private createSpriteDisplay(object: SceneObject): Sprite | AnimatedSprite | null {
    const sprite = object.sprite;
    if (!sprite?.imageUrl && !sprite?.sheetUrl) return null;

    const asset = this.spriteAssetCache.get(sprite, () => this.render());
    if (!asset) return null;

    const display =
      asset.kind === "textures" && asset.textures.length > 0
        ? new AnimatedSprite(asset.textures)
        : new Sprite(asset.kind === "texture" ? asset.texture : asset.textures[0]);

    display.anchor.set(0.5);
    display.width = object.width;
    display.height = object.height;

    if (display instanceof AnimatedSprite) {
      display.animationSpeed = sprite.animationSpeed;
      if (sprite.playing) display.play();
      else display.gotoAndStop(0);
    }

    return display;
  }

  private drawSelection(object: SceneObject, showHandles: boolean): void {
    const selection = this.selectionOverlayRenderer.drawSelection(object, showHandles, (value) => this.toWorldPixels(value));
    this.world.addChild(selection);
  }

  private toColorNumber(value: string): number {
    const normalized = value.replace("#", "");
    const parsed = Number.parseInt(normalized, 16);
    return Number.isFinite(parsed) ? parsed : 0x16a34a;
  }

  private toWorldPixels(value: number): number {
    return this.camera.toWorldPixels(value);
  }
}
