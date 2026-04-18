import type { PhysicsMode, SceneObject } from "../../shared/types";
import { EditorState } from "../state/EditorState";

export class InspectorPanel {
  constructor(
    private readonly root: HTMLElement,
    private readonly state: EditorState
  ) {}

  render(): void {
    const object = this.state.selectedObject;
    if (!object) {
      this.root.innerHTML = `<h2>Properties</h2><p class="empty">Select an object to edit its properties.</p>`;
      return;
    }

    this.root.innerHTML = `
      <h2>Properties</h2>
      <div class="inspector-grid">
        ${this.textField("name", "Name", object.name)}
        ${this.numberField("x", "X", object.x)}
        ${this.numberField("y", "Y", object.y)}
        ${this.numberField("width", "Width", object.width)}
        ${this.numberField("height", "Height", object.height)}
        ${this.numberField("rotation", "Rotation", object.rotation)}
        ${this.numberField("zIndex", "Layer", object.zIndex)}
        ${this.colorField("fill", "Fill", object.fill)}
      </div>
      <h3>Physics</h3>
      <label class="field">
        <span>Body</span>
        <select data-physics="mode">
          <option value="static" ${object.physics.mode === "static" ? "selected" : ""}>static</option>
          <option value="dynamic" ${object.physics.mode === "dynamic" ? "selected" : ""}>dynamic</option>
        </select>
      </label>
      <div class="inspector-grid">
        ${this.numberField("mass", "Mass", object.physics.mass, "physics")}
        ${this.numberField("gravityX", "Gravity X", object.physics.gravity.x, "gravity")}
        ${this.numberField("gravityY", "Gravity Y", object.physics.gravity.y, "gravity")}
        ${this.numberField("velocityX", "Velocity X", object.physics.velocity.x, "velocity")}
        ${this.numberField("velocityY", "Velocity Y", object.physics.velocity.y, "velocity")}
      </div>
      <label class="checkbox-field">
        <input type="checkbox" data-physics="collision" ${object.physics.collision ? "checked" : ""} />
        <span>Collision enabled</span>
      </label>
    `;

    this.bindObjectInputs(object);
    this.bindPhysicsInputs(object);
  }

  private bindObjectInputs(object: SceneObject): void {
    this.root.querySelectorAll<HTMLInputElement>("[data-object-prop]").forEach((input) => {
      input.addEventListener("change", () => {
        const prop = input.dataset.objectProp as keyof SceneObject;
        const value = input.type === "number" ? Number(input.value) : input.value;
        this.state.updateObject(object.id, { [prop]: value } as Partial<SceneObject>);
      });
    });
  }

  private bindPhysicsInputs(object: SceneObject): void {
    this.root.querySelector<HTMLSelectElement>('[data-physics="mode"]')?.addEventListener("change", (event) => {
      this.state.updatePhysics(object.id, { mode: (event.target as HTMLSelectElement).value as PhysicsMode });
    });

    this.root.querySelector<HTMLInputElement>('[data-physics="collision"]')?.addEventListener("change", (event) => {
      this.state.updatePhysics(object.id, { collision: (event.target as HTMLInputElement).checked });
    });

    this.root.querySelector<HTMLInputElement>('[data-physics="mass"]')?.addEventListener("change", (event) => {
      this.state.updatePhysics(object.id, { mass: Number((event.target as HTMLInputElement).value) });
    });

    this.root.querySelector<HTMLInputElement>('[data-gravity="gravityX"]')?.addEventListener("change", (event) => {
      this.state.updateGravity(object.id, { x: Number((event.target as HTMLInputElement).value) });
    });
    this.root.querySelector<HTMLInputElement>('[data-gravity="gravityY"]')?.addEventListener("change", (event) => {
      this.state.updateGravity(object.id, { y: Number((event.target as HTMLInputElement).value) });
    });
    this.root.querySelector<HTMLInputElement>('[data-velocity="velocityX"]')?.addEventListener("change", (event) => {
      this.state.updateVelocity(object.id, { x: Number((event.target as HTMLInputElement).value) });
    });
    this.root.querySelector<HTMLInputElement>('[data-velocity="velocityY"]')?.addEventListener("change", (event) => {
      this.state.updateVelocity(object.id, { y: Number((event.target as HTMLInputElement).value) });
    });
  }

  private textField(prop: keyof SceneObject, label: string, value: string): string {
    return `<label class="field"><span>${label}</span><input data-object-prop="${String(prop)}" value="${value}" /></label>`;
  }

  private numberField(prop: string, label: string, value: number, group = "object-prop"): string {
    const attr = group === "object-prop" ? `data-object-prop="${prop}"` : `data-${group}="${prop}"`;
    return `<label class="field"><span>${label}</span><input type="number" step="1" ${attr} value="${value}" /></label>`;
  }

  private colorField(prop: keyof SceneObject, label: string, value: string): string {
    return `<label class="field"><span>${label}</span><input type="color" data-object-prop="${String(prop)}" value="${value}" /></label>`;
  }
}
