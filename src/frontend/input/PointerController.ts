import { PixiRenderer, type ResizeHandle } from "../rendering/PixiRenderer";
import { EditorState } from "../state/EditorState";
import type { SceneObject } from "../../shared/types";

type DragMode = "move" | "resize" | "select" | "pan" | "tile-paint" | null;
type ObjectStart = Pick<SceneObject, "id" | "x" | "y" | "width" | "height">;

export class PointerController {
  private dragMode: DragMode = null;
  private resizeHandle: ResizeHandle | null = null;
  private dragStart = { x: 0, y: 0 };
  private viewportDragStart = { x: 0, y: 0 };
  private objectStart = { x: 0, y: 0, width: 0, height: 0 };
  private objectStarts: ObjectStart[] = [];
  private readonly marquee = document.createElement("div");
  private isSpacePressed = false;

  constructor(
    private readonly view: HTMLCanvasElement,
    private readonly state: EditorState,
    private readonly renderer: PixiRenderer
  ) {
    const wheelTarget = view.parentElement ?? view;
    view.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    view.addEventListener("pointermove", (event) => this.onPointerMove(event));
    view.addEventListener("pointerup", (event) => this.onPointerUp(event));
    view.addEventListener("pointercancel", (event) => this.onPointerUp(event));
    view.addEventListener("wheel", (event) => this.onWheel(event), { passive: false });
    if (wheelTarget !== view) wheelTarget.addEventListener("wheel", (event) => this.onWheel(event), { passive: false });
    this.marquee.className = "selection-marquee";
    this.marquee.hidden = true;
    this.view.parentElement?.appendChild(this.marquee);
    window.addEventListener("keydown", (event) => {
      if (event.code === "Space" && !this.isTextInput(event.target)) {
        this.isSpacePressed = true;
      }

      if (!this.isTextInput(event.target) && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        this.renderer.zoomAt(this.getViewportCenter(), 1.1);
        return;
      }

      if (!this.isTextInput(event.target) && event.key === "-") {
        event.preventDefault();
        this.renderer.zoomAt(this.getViewportCenter(), 1 / 1.1);
        return;
      }

      if (!this.isTextInput(event.target) && event.key === "0") {
        event.preventDefault();
        this.renderer.resetView();
        return;
      }

      if (!this.isTextInput(event.target) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        this.renderer.frameObjects(this.state.selectedObjects);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !this.isTextInput(event.target)) {
        event.preventDefault();
        if (event.shiftKey) this.state.redo();
        else this.state.undo();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y" && !this.isTextInput(event.target)) {
        event.preventDefault();
        this.state.redo();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && !this.isTextInput(event.target)) {
        event.preventDefault();
        this.state.copySelected();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v" && !this.isTextInput(event.target)) {
        event.preventDefault();
        this.state.pasteObjects();
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && !this.isTextInput(event.target)) {
        event.preventDefault();
        this.state.deleteSelected();
      }
    });
    window.addEventListener("keyup", (event) => {
      if (event.code === "Space") this.isSpacePressed = false;
    });
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button === 1 || (event.button === 0 && this.isSpacePressed)) {
      this.startPanDrag(event);
      return;
    }

    if (event.button === 0 && this.state.toolMode !== "object") {
      const point = this.toScenePoint(event);
      this.view.setPointerCapture(event.pointerId);
      this.dragMode = "tile-paint";
      this.state.beginHistoryBatch();
      if (this.state.toolMode === "tile-paint") this.state.paintTileAt(point);
      else this.state.eraseTileAt(point);
      return;
    }

    const point = this.toScenePoint(event);
    const control = this.renderer.hitSelectionControl(point);

    const selected = this.state.selectedObject;
    if (control?.type === "resize" && selected) {
      this.startDrag(event, point, "resize", selected, control.handle);
      return;
    }

    const hit = this.renderer.hitTest(point);
    if (!hit) {
      this.startSelectionDrag(event, point);
      return;
    }

    if (!this.state.isSelected(hit.id)) this.state.selectObject(hit.id);

    this.startDrag(event, point, "move", hit);
  }

  private startPanDrag(event: PointerEvent): void {
    this.view.setPointerCapture(event.pointerId);
    this.dragMode = "pan";
    this.viewportDragStart = this.toViewportPoint(event);
    this.view.style.cursor = "grabbing";
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
    this.objectStarts = this.state.selectedObjects.map((selected) => ({
      id: selected.id,
      x: selected.x,
      y: selected.y,
      width: selected.width,
      height: selected.height
    }));
    this.dragMode = mode;
    this.resizeHandle = handle;
    if (mode === "move" || mode === "resize") this.state.beginHistoryBatch();
  }

  private startSelectionDrag(event: PointerEvent, point: { x: number; y: number }): void {
    this.view.setPointerCapture(event.pointerId);
    this.dragStart = point;
    this.dragMode = "select";
    this.marquee.hidden = false;
    this.updateMarquee(point);
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.dragMode) {
      this.updateCursor(event);
      return;
    }

    if (!this.dragMode) return;
    if (this.dragMode === "pan") {
      const point = this.toViewportPoint(event);
      this.renderer.panBy(point.x - this.viewportDragStart.x, point.y - this.viewportDragStart.y);
      this.viewportDragStart = point;
      return;
    }

    if (this.dragMode === "tile-paint") {
      const point = this.toScenePoint(event);
      if (this.state.toolMode === "tile-paint") this.state.paintTileAt(point);
      else this.state.eraseTileAt(point);
      return;
    }

    const point = this.toScenePoint(event);
    const dx = point.x - this.dragStart.x;
    const dy = point.y - this.dragStart.y;

    if (this.dragMode === "select") {
      this.updateMarquee(point);
    } else if (this.dragMode === "move") {
      if (this.objectStarts.length === 0) return;
      this.moveSelected(dx, dy);
    } else {
      if (!this.state.selectedObjectId) return;
      this.resizeSelected(dx, dy);
    }
  }

  private onPointerUp(event: PointerEvent): void {
    if (this.dragMode === "select") {
      const rect = this.getSelectionRect(this.dragStart, this.toScenePoint(event));
      const selected = rect.width > 3 || rect.height > 3 ? this.renderer.hitTestRect(rect) : [];
      this.state.selectObjects(selected.map((object) => object.id));
    }

    this.dragMode = null;
    this.resizeHandle = null;
    this.objectStarts = [];
    this.marquee.hidden = true;
    this.state.endHistoryBatch();
    this.updateCursor(event);
  }

  private moveSelected(dx: number, dy: number): void {
    this.state.updateObjects(
      this.objectStarts.map((object) => ({
        id: object.id,
        patch: {
          x: this.state.snapValue(object.x + dx),
          y: this.state.snapValue(object.y + dy)
        }
      }))
    );
  }

  private resizeSelected(dx: number, dy: number): void {
    if (!this.resizeHandle) return;
    if (this.state.selectedObject?.locked) return;

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
      x: this.state.snapValue(patch.x),
      y: this.state.snapValue(patch.y),
      width: Math.max(minSize, this.state.snapValue(patch.width)),
      height: Math.max(minSize, this.state.snapValue(patch.height))
    });
  }

  private updateCursor(event: PointerEvent): void {
    if (this.dragMode === "pan") {
      this.view.style.cursor = "grabbing";
      return;
    }

    if (this.isSpacePressed) {
      this.view.style.cursor = "grab";
      return;
    }

    if (this.state.toolMode === "tile-paint") {
      this.view.style.cursor = "crosshair";
      return;
    }

    if (this.state.toolMode === "tile-erase") {
      this.view.style.cursor = "cell";
      return;
    }

    const point = this.toScenePoint(event);
    const control = this.renderer.hitSelectionControl(point);
    if (control?.type === "resize") {
      this.view.style.cursor = control.handle === "nw" || control.handle === "se" ? "nwse-resize" : "nesw-resize";
      return;
    }

    this.view.style.cursor = this.renderer.hitTest(point) ? "move" : "default";
  }

  private updateMarquee(point: { x: number; y: number }): void {
    const rect = this.getSelectionRect(this.dragStart, point);
    const viewportRect = this.renderer.toViewportRect(rect);
    this.marquee.style.left = `${viewportRect.x}px`;
    this.marquee.style.top = `${viewportRect.y}px`;
    this.marquee.style.width = `${viewportRect.width}px`;
    this.marquee.style.height = `${viewportRect.height}px`;
  }

  private getSelectionRect(start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number; width: number; height: number } {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    return {
      x,
      y,
      width: Math.max(start.x, end.x) - x,
      height: Math.max(start.y, end.y) - y
    };
  }

  private toViewportPoint(event: Pick<MouseEvent, "clientX" | "clientY">): { x: number; y: number } {
    const rect = this.view.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  private toScenePoint(event: PointerEvent): { x: number; y: number } {
    return this.renderer.toScenePoint(this.toViewportPoint(event));
  }

  private onWheel(event: WheelEvent): void {
    if (this.isTextInput(event.target)) return;
    event.preventDefault();
    const point = this.toViewportPoint(event);
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.renderer.zoomAt(point, factor);
  }

  private getViewportCenter(): { x: number; y: number } {
    return {
      x: this.view.clientWidth / 2,
      y: this.view.clientHeight / 2
    };
  }

  private isTextInput(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest("input, select, textarea, [contenteditable='true']"));
  }
}
