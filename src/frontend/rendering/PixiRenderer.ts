import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import type { SceneObject } from "../../shared/types";
import { EditorState } from "../state/EditorState";

export class PixiRenderer {
  private readonly app: Application;
  private readonly world = new Container();

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

  render(): void {
    this.world.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.drawBackground();
    this.drawSceneBounds();
    for (const object of this.state.scene.objects) this.drawObject(object);

    const selected = this.state.selectedObject;
    if (selected) this.drawSelection(selected);
  }

  hitTest(point: { x: number; y: number }): SceneObject | null {
    const sorted = [...this.state.scene.objects].sort((a, b) => b.zIndex - a.zIndex);
    return sorted.find((object) => this.containsPoint(object, point)) ?? null;
  }

  private containsPoint(object: SceneObject, point: { x: number; y: number }): boolean {
    const cx = object.x + object.width / 2;
    const cy = object.y + object.height / 2;
    const radians = (-object.rotation * Math.PI) / 180;
    const dx = point.x - cx;
    const dy = point.y - cy;
    const localX = dx * Math.cos(radians) - dy * Math.sin(radians) + object.width / 2;
    const localY = dx * Math.sin(radians) + dy * Math.cos(radians) + object.height / 2;
    return localX >= 0 && localY >= 0 && localX <= object.width && localY <= object.height;
  }

  private drawBackground(): void {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    const grid = new Graphics();
    grid.zIndex = -1000;
    grid.beginFill(0xf4f7fb);
    grid.drawRect(0, 0, width, height);
    grid.endFill();
    grid.lineStyle(1, 0xd8e0ea, 1);

    for (let x = 0; x < width; x += 32) {
      grid.moveTo(x, 0);
      grid.lineTo(x, height);
    }

    for (let y = 0; y < height; y += 32) {
      grid.moveTo(0, y);
      grid.lineTo(width, y);
    }

    this.world.addChild(grid);
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

  private drawSelection(object: SceneObject): void {
    const selection = new Graphics();
    selection.position.set(object.x + object.width / 2, object.y + object.height / 2);
    selection.rotation = (object.rotation * Math.PI) / 180;
    selection.zIndex = 100000;
    selection.lineStyle(2, 0xef4444, 1);
    selection.drawRect(-object.width / 2 - 5, -object.height / 2 - 5, object.width + 10, object.height + 10);
    selection.beginFill(0xef4444);
    selection.drawRect(object.width / 2 - 2, object.height / 2 - 2, 12, 12);
    selection.endFill();
    this.world.addChild(selection);
  }

  private toColorNumber(value: string): number {
    const normalized = value.replace("#", "");
    const parsed = Number.parseInt(normalized, 16);
    return Number.isFinite(parsed) ? parsed : 0x16a34a;
  }
}
