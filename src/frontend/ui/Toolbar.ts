import type { ObjectType } from "../../shared/types";
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
        <button data-action="delete" ${this.state.selectedObjectId ? "" : "disabled"}>Delete</button>
        <button data-action="new">New</button>
        <button data-action="save">Save</button>
      </div>
    `;

    this.root.querySelectorAll<HTMLButtonElement>("[data-add]").forEach((button) => {
      button.addEventListener("click", () => this.state.addObject(button.dataset.add as ObjectType));
    });

    this.root.querySelector<HTMLButtonElement>('[data-action="save"]')?.addEventListener("click", this.onSave);
    this.root.querySelector<HTMLButtonElement>('[data-action="new"]')?.addEventListener("click", this.onNewScene);
    this.root.querySelector<HTMLButtonElement>('[data-action="delete"]')?.addEventListener("click", () => this.state.deleteSelected());
  }
}
