import { EditorState } from "../state/EditorState";

export class HierarchyPanel {
  constructor(
    private readonly root: HTMLElement,
    private readonly state: EditorState
  ) {}

  render(): void {
    const objects = [...this.state.scene.objects].sort((a, b) => b.zIndex - a.zIndex);
    this.root.innerHTML = `
      <h2>Scene Hierarchy</h2>
      <label class="field">
        <span>Scene name</span>
        <input data-scene-name value="${this.escape(this.state.scene.name)}" />
      </label>
      <div class="object-list">
        ${objects
          .map(
            (object) => `
              <div class="object-row ${this.state.isSelected(object.id) ? "selected" : ""}">
                <button class="object-select" data-object-id="${object.id}">
                  <span>${this.escape(object.name)}</span>
                  <small>${object.type} - z ${object.zIndex}</small>
                </button>
                <button class="object-delete" data-delete-object-id="${object.id}" aria-label="Delete ${this.escape(object.name)}">x</button>
              </div>
            `
          )
          .join("")}
      </div>
    `;

    this.root.querySelector<HTMLInputElement>("[data-scene-name]")?.addEventListener("input", (event) => {
      this.state.setSceneName((event.target as HTMLInputElement).value);
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-object-id]").forEach((button) => {
      button.addEventListener("click", () => this.state.selectObject(button.dataset.objectId ?? null));
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-delete-object-id]").forEach((button) => {
      button.addEventListener("click", () => this.state.deleteObject(button.dataset.deleteObjectId ?? ""));
    });
  }

  private escape(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
      return entities[char];
    });
  }
}
