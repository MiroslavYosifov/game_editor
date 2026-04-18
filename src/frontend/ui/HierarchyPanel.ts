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
              <button class="object-row ${this.state.selectedObjectId === object.id ? "selected" : ""}" data-object-id="${object.id}">
                <span>${this.escape(object.name)}</span>
                <small>${object.type} · z ${object.zIndex}</small>
              </button>
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
  }

  private escape(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
      return entities[char];
    });
  }
}
