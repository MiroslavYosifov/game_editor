import { PixiRenderer, type ResizeHandle } from "../rendering/PixiRenderer";
import { EditorState } from "../state/EditorState";
import type { SceneObject } from "../../shared/types";

type DragMode = "move" | "resize" | null;

export class PointerController {
  private dragMode: DragMode = null;
  private resizeHandle: ResizeHandle | null = null;
  private dragStart = { x: 0, y: 0 };
  private objectStart = { x: 0, y: 0, width: 0, height: 0 };

  constructor(
    private readonly view: HTMLCanvasElement,
    private readonly state: EditorState,
    private readonly renderer: PixiRenderer
  ) {
    view.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    view.addEventListener("pointermove", (event) => this.onPointerMove(event));
    view.addEventListener("pointerup", () => this.onPointerUp());
    view.addEventListener("pointercancel", () => this.onPointerUp());
    window.addEventListener("keydown", (event) => {
      if ((event.key === "Delete" || event.key === "Backspace") && !this.isTextInput(event.target)) {
        event.preventDefault();
        this.state.deleteSelected();
      }
    });
  }

  private onPointerDown(event: PointerEvent): void {
    const point = this.toViewportPoint(event);
    const control = this.renderer.hitSelectionControl(point);

    const selected = this.state.selectedObject;
    if (control?.type === "resize" && selected) {
      this.startDrag(event, point, "resize", selected, control.handle);
      return;
    }

    const hit = this.renderer.hitTest(point);
    this.state.selectObject(hit?.id ?? null);
    if (!hit) return;

    this.startDrag(event, point, "move", hit);
  }

  private startDrag(
    event: PointerEvent,
    point: { x: number; y: number },
    mode: DragMode,
    object: SceneObject,
    handle: ResizeHandle | null = null
  ): void {
    if (!object || !mode) return;
    this.view.setPointerCapture(event.pointerId);
    this.dragStart = point;
    this.objectStart = { x: object.x, y: object.y, width: object.width, height: object.height };
    this.dragMode = mode;
    this.resizeHandle = handle;
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.dragMode) {
      this.updateCursor(event);
      return;
    }

    if (!this.dragMode || !this.state.selectedObjectId) return;
    const point = this.toViewportPoint(event);
    const dx = point.x - this.dragStart.x;
    const dy = point.y - this.dragStart.y;

    if (this.dragMode === "move") {
      this.state.updateSelected({
        x: Math.round(this.objectStart.x + dx),
        y: Math.round(this.objectStart.y + dy)
      });
    } else {
      this.resizeSelected(dx, dy);
    }
  }

  private onPointerUp(): void {
    this.dragMode = null;
    this.resizeHandle = null;
  }

  private resizeSelected(dx: number, dy: number): void {
    if (!this.resizeHandle) return;

    const minSize = 12;
    const patch = {
      x: this.objectStart.x,
      y: this.objectStart.y,
      width: this.objectStart.width,
      height: this.objectStart.height
    };

    if (this.resizeHandle.includes("e")) {
      patch.width = Math.max(minSize, this.objectStart.width + dx);
    }

    if (this.resizeHandle.includes("s")) {
      patch.height = Math.max(minSize, this.objectStart.height + dy);
    }

    if (this.resizeHandle.includes("w")) {
      const width = Math.max(minSize, this.objectStart.width - dx);
      patch.x = this.objectStart.x + this.objectStart.width - width;
      patch.width = width;
    }

    if (this.resizeHandle.includes("n")) {
      const height = Math.max(minSize, this.objectStart.height - dy);
      patch.y = this.objectStart.y + this.objectStart.height - height;
      patch.height = height;
    }

    this.state.updateSelected({
      x: Math.round(patch.x),
      y: Math.round(patch.y),
      width: Math.round(patch.width),
      height: Math.round(patch.height)
    });
  }

  private updateCursor(event: PointerEvent): void {
    const point = this.toViewportPoint(event);
    const control = this.renderer.hitSelectionControl(point);
    if (control?.type === "resize") {
      this.view.style.cursor = control.handle === "nw" || control.handle === "se" ? "nwse-resize" : "nesw-resize";
      return;
    }

    this.view.style.cursor = this.renderer.hitTest(point) ? "move" : "default";
  }

  private toViewportPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.view.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  private isTextInput(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest("input, select, textarea, [contenteditable='true']"));
  }
}
