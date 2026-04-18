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
        ${objectTypes.map((type) => `<button data-add="${type}">Add ${type}</button>`).join("")}
      </div>
      <div class="toolbar-group">
        <button data-action="delete" ${this.state.selectedObjectIds.length > 0 ? "" : "disabled"}>Delete</button>
        <button data-action="new">New</button>
        <button data-action="save">Save</button>
        <button data-action="import">Import JSON</button>
        <button data-action="export">Export JSON</button>
        <input data-import-file type="file" accept="application/json,.json" hidden />
      </div>
    `;

    this.root.querySelectorAll<HTMLButtonElement>("[data-add]").forEach((button) => {
      button.addEventListener("click", () => this.state.addObject(button.dataset.add as ObjectType));
    });

    this.root.querySelector<HTMLButtonElement>('[data-action="save"]')?.addEventListener("click", this.onSave);
    this.root.querySelector<HTMLButtonElement>('[data-action="new"]')?.addEventListener("click", this.onNewScene);
    this.root.querySelector<HTMLButtonElement>('[data-action="delete"]')?.addEventListener("click", () => this.state.deleteSelected());
    this.root.querySelector<HTMLButtonElement>('[data-action="export"]')?.addEventListener("click", () => this.exportScene());

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
