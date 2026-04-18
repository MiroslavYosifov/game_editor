import type { ObjectType, Scene } from "../../shared/types";
import { EditorState } from "../state/EditorState";

export class Toolbar {
  constructor(
    private readonly root: HTMLElement,
    private readonly state: EditorState,
    private readonly onSave: () => void,
    private readonly onNewScene: () => void
  ) {}

  render(): void {
    const objectTypes: ObjectType[] = ["rectangle", "circle", "sprite", "text"];
    this.root.innerHTML = `
      <div class="toolbar-group">
        ${objectTypes.map((type) => `<button class="toolbar-btn" data-add="${type}">Add ${type}</button>`).join("")}
      </div>
      <div class="toolbar-group grid-controls">
        <label class="toolbar-check">
          <input data-snap-toggle type="checkbox" ${this.state.snapToGrid ? "checked" : ""} />
          <span>Snap</span>
        </label>
        <label class="toolbar-field">
          <span>Grid</span>
          <input data-grid-size type="number" min="4" max="256" step="4" value="${this.state.gridSize}" />
        </label>
      </div>
      <div class="toolbar-group">
        <button class="toolbar-btn btn-undo" data-action="undo" ${this.state.canUndo ? "" : "disabled"}>Undo</button>
        <button class="toolbar-btn btn-redo" data-action="redo" ${this.state.canRedo ? "" : "disabled"}>Redo</button>
        <button class="toolbar-btn btn-new" data-action="new">New</button>
        <button class="toolbar-btn btn-save" data-action="save">Save</button>
        <button class="toolbar-btn btn-primary" data-action="import">Import JSON</button>
        <button class="toolbar-btn btn-secondary" data-action="export">Export JSON</button>
        <input data-import-file type="file" accept="application/json,.json" hidden />
      </div>
    `;

    this.root.querySelectorAll<HTMLButtonElement>("[data-add]").forEach((button) => {
      button.addEventListener("click", () => this.state.addObject(button.dataset.add as ObjectType));
    });

    this.root.querySelector<HTMLButtonElement>('[data-action="save"]')?.addEventListener("click", this.onSave);
    this.root.querySelector<HTMLButtonElement>('[data-action="new"]')?.addEventListener("click", this.onNewScene);
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
}
