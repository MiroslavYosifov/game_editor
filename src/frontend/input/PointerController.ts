import { PixiRenderer } from "../rendering/PixiRenderer";
import { EditorState } from "../state/EditorState";

type DragMode = "move" | "resize" | null;

export class PointerController {
  private dragMode: DragMode = null;
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
      if (event.key === "Delete" || event.key === "Backspace") this.state.deleteSelected();
    });
  }

  private onPointerDown(event: PointerEvent): void {
    const point = this.toViewportPoint(event);
    const hit = this.renderer.hitTest(point);

    if (this.state.activeTool === "delete") {
      if (hit) {
        this.state.selectObject(hit.id);
        this.state.deleteSelected();
      }
      return;
    }

    this.state.selectObject(hit?.id ?? null);
    if (!hit) return;
    if (this.state.activeTool === "select") return;

    this.view.setPointerCapture(event.pointerId);
    this.dragStart = point;
    this.objectStart = { x: hit.x, y: hit.y, width: hit.width, height: hit.height };
    this.dragMode = this.state.activeTool === "resize" ? "resize" : "move";
  }

  private onPointerMove(event: PointerEvent): void {
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
      this.state.updateSelected({
        width: Math.max(12, Math.round(this.objectStart.width + dx)),
        height: Math.max(12, Math.round(this.objectStart.height + dy))
      });
    }
  }

  private onPointerUp(): void {
    this.dragMode = null;
  }

  private toViewportPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.view.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }
}
