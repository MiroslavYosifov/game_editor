import type { ObjectType, Scene, SceneSummary } from "../../shared/types";
import { EditorState } from "../state/EditorState";

export class Toolbar {
  constructor(
    private readonly root: HTMLElement,
    private readonly state: EditorState,
    private readonly getScenes: () => SceneSummary[],
    private readonly onLoadScene: (id: string) => void,
    private readonly onDeleteScene: (id: string) => void,
    private readonly onRefreshScenes: () => void,
    private readonly onSave: () => void,
    private readonly onSaveAs: () => void,
    private readonly onFrameSelected: () => void,
    private readonly onFitView: () => void,
    private readonly onZoomIn: () => void,
    private readonly onZoomOut: () => void,
    private readonly onNewScene: () => void
  ) {}

  render(): void {
    const objectTypes: Array<{ type: ObjectType; label: string }> = [
      { type: "rectangle", label: "Rect" },
      { type: "circle", label: "Circle" },
      { type: "sprite", label: "Sprite" },
      { type: "text", label: "Text" }
    ];
    this.root.innerHTML = `
      <div class="toolbar-row toolbar-main-row">
        <div class="toolbar-group load-controls">
          <label class="toolbar-field scene-load-field">
            <span>Scene</span>
            <select data-load-scene>
              ${this.getScenes()
                .map(
                  (scene) => `
                    <option value="${scene.id}" ${this.state.scene.id === scene.id ? "selected" : ""}>
                      ${this.escape(scene.name)} (${scene.objectCount})
                    </option>
                  `
                )
                .join("") || '<option value="">No saved scenes</option>'}
            </select>
          </label>
          <button class="toolbar-btn" data-action="load-scene">Load</button>
          <button class="toolbar-btn btn-danger" data-action="delete-scene">Delete</button>
          <button class="toolbar-btn" data-action="refresh-scenes">Refresh</button>
        </div>
        <div class="toolbar-group">
          <button class="toolbar-btn btn-undo" data-action="undo" ${this.state.canUndo ? "" : "disabled"}>Undo</button>
          <button class="toolbar-btn btn-redo" data-action="redo" ${this.state.canRedo ? "" : "disabled"}>Redo</button>
          <button class="toolbar-btn btn-new" data-action="new">New</button>
          <button class="toolbar-btn btn-save" data-action="save">Save</button>
          <button class="toolbar-btn btn-primary" data-action="save-as">Save As</button>
          <button class="toolbar-btn btn-primary" data-action="import">Import JSON</button>
          <button class="toolbar-btn btn-secondary" data-action="export">Export JSON</button>
          <input data-import-file type="file" accept="application/json,.json" hidden />
        </div>
      </div>
      <div class="toolbar-row toolbar-sub-row">
        <div class="toolbar-group compact-tools">
          <span class="tool-strip-label">Add</span>
          ${objectTypes.map((item) => `<button class="toolbar-btn compact-tool-btn" data-add="${item.type}">${item.label}</button>`).join("")}
        </div>
        <div class="toolbar-group compact-tools">
          <span class="tool-strip-label">Arrange</span>
          <button class="toolbar-btn compact-tool-btn" data-align="left" title="Align left">L</button>
          <button class="toolbar-btn compact-tool-btn" data-align="center" title="Align center">HC</button>
          <button class="toolbar-btn compact-tool-btn" data-align="right" title="Align right">R</button>
          <button class="toolbar-btn compact-tool-btn" data-align="top" title="Align top">T</button>
          <button class="toolbar-btn compact-tool-btn" data-align="middle" title="Align middle">VC</button>
          <button class="toolbar-btn compact-tool-btn" data-align="bottom" title="Align bottom">B</button>
          <button class="toolbar-btn compact-tool-btn" data-distribute="horizontal" title="Distribute horizontally">DH</button>
          <button class="toolbar-btn compact-tool-btn" data-distribute="vertical" title="Distribute vertically">DV</button>
        </div>
        <div class="toolbar-group grid-controls compact-grid-controls">
          <span class="tool-strip-label">Grid</span>
          <label class="toolbar-check">
            <input data-snap-toggle type="checkbox" ${this.state.snapToGrid ? "checked" : ""} />
            <span>Snap</span>
          </label>
          <label class="toolbar-field">
            <span>Grid</span>
            <input data-grid-size type="number" min="4" max="256" step="4" value="${this.state.gridSize}" />
          </label>
        </div>
        <div class="toolbar-group canvas-controls compact-grid-controls">
          <span class="tool-strip-label">Canvas</span>
          <button class="toolbar-btn compact-tool-btn" data-action="fit-view">Fit</button>
          <button class="toolbar-btn compact-tool-btn" data-action="frame-selected">Frame</button>
          <button class="toolbar-btn compact-tool-btn" data-action="zoom-in" aria-label="Zoom in">+</button>
          <button class="toolbar-btn compact-tool-btn" data-action="zoom-out" aria-label="Zoom out">-</button>
          <label class="toolbar-field">
            <span>W</span>
            <input data-scene-width type="number" min="64" max="8192" step="16" value="${this.state.scene.width}" />
          </label>
          <label class="toolbar-field">
            <span>H</span>
            <input data-scene-height type="number" min="64" max="8192" step="16" value="${this.state.scene.height}" />
          </label>
        </div>
      </div>
    `;

    this.root.querySelectorAll<HTMLButtonElement>("[data-add]").forEach((button) => {
      button.addEventListener("click", () => this.state.addObject(button.dataset.add as ObjectType));
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-align]").forEach((button) => {
      button.addEventListener("click", () => this.state.alignSelected(button.dataset.align as "left" | "center" | "right" | "top" | "middle" | "bottom"));
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-distribute]").forEach((button) => {
      button.addEventListener("click", () => this.state.distributeSelected(button.dataset.distribute as "horizontal" | "vertical"));
    });

    this.root.querySelector<HTMLButtonElement>('[data-action="save"]')?.addEventListener("click", this.onSave);
    this.root.querySelector<HTMLButtonElement>('[data-action="save-as"]')?.addEventListener("click", this.onSaveAs);
    this.root.querySelector<HTMLButtonElement>('[data-action="fit-view"]')?.addEventListener("click", this.onFitView);
    this.root.querySelector<HTMLButtonElement>('[data-action="frame-selected"]')?.addEventListener("click", this.onFrameSelected);
    this.root.querySelector<HTMLButtonElement>('[data-action="zoom-in"]')?.addEventListener("click", this.onZoomIn);
    this.root.querySelector<HTMLButtonElement>('[data-action="zoom-out"]')?.addEventListener("click", this.onZoomOut);
    this.root.querySelector<HTMLButtonElement>('[data-action="new"]')?.addEventListener("click", this.onNewScene);
    this.root.querySelector<HTMLButtonElement>('[data-action="load-scene"]')?.addEventListener("click", () => {
      const sceneId = this.root.querySelector<HTMLSelectElement>("[data-load-scene]")?.value;
      if (sceneId) this.onLoadScene(sceneId);
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="delete-scene"]')?.addEventListener("click", () => {
      const sceneId = this.root.querySelector<HTMLSelectElement>("[data-load-scene]")?.value;
      if (sceneId) this.onDeleteScene(sceneId);
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="refresh-scenes"]')?.addEventListener("click", this.onRefreshScenes);
    this.root.querySelector<HTMLButtonElement>('[data-action="undo"]')?.addEventListener("click", () => this.state.undo());
    this.root.querySelector<HTMLButtonElement>('[data-action="redo"]')?.addEventListener("click", () => this.state.redo());
    this.root.querySelector<HTMLButtonElement>('[data-action="delete"]')?.addEventListener("click", () => this.state.deleteSelected());
    this.root.querySelector<HTMLButtonElement>('[data-action="export"]')?.addEventListener("click", () => this.exportScene());
    this.root.querySelector<HTMLInputElement>("[data-snap-toggle]")?.addEventListener("change", (event) => {
      this.state.setSnapToGrid((event.target as HTMLInputElement).checked);
    });
    this.root.querySelector<HTMLInputElement>("[data-grid-size]")?.addEventListener("input", (event) => {
      const value = Number((event.target as HTMLInputElement).value);
      if (Number.isFinite(value)) this.state.previewGridSize(value);
    });
    this.root.querySelector<HTMLInputElement>("[data-scene-width]")?.addEventListener("input", (event) => {
      const value = Number((event.target as HTMLInputElement).value);
      if (Number.isFinite(value)) this.state.previewSceneSize({ width: value });
    });
    this.root.querySelector<HTMLInputElement>("[data-scene-height]")?.addEventListener("input", (event) => {
      const value = Number((event.target as HTMLInputElement).value);
      if (Number.isFinite(value)) this.state.previewSceneSize({ height: value });
    });

    const importInput = this.root.querySelector<HTMLInputElement>("[data-import-file]");
    this.root.querySelector<HTMLButtonElement>('[data-action="import"]')?.addEventListener("click", () => importInput?.click());
    importInput?.addEventListener("change", () => void this.importScene(importInput));
  }

  private exportScene(): void {
    const json = JSON.stringify(this.state.scene, null, 2);
    const blob = new Blob([`${json}\n`], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${this.toFileName(this.state.scene.name)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private async importScene(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    try {
      const scene = JSON.parse(await file.text()) as unknown;
      if (!this.isScene(scene)) throw new Error("Invalid scene JSON.");
      this.state.setScene({ ...scene, updatedAt: new Date().toISOString() });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Import failed.");
    }
  }

  private isScene(value: unknown): value is Scene {
    if (!value || typeof value !== "object") return false;
    const scene = value as Partial<Scene>;
    return (
      typeof scene.id === "string" &&
      typeof scene.name === "string" &&
      typeof scene.width === "number" &&
      typeof scene.height === "number" &&
      Array.isArray(scene.objects)
    );
  }

  private toFileName(value: string): string {
    return value.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "scene";
  }

  private escape(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
      return entities[char];
    });
  }
}
