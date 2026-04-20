import type { AssetSummary, PhysicsMode, SceneObject } from "../../shared/types";
import { EditorState } from "../state/EditorState";

export class InspectorPanel {
  constructor(
    private readonly root: HTMLElement,
    private readonly state: EditorState,
    private readonly getAssets: () => AssetSummary[] = () => [],
    private readonly onUploadImage: (file: File) => Promise<AssetSummary | null> = async () => null,
    private readonly onRefreshAssets: () => Promise<void> | void = () => undefined
  ) {}

  render(): void {
    if (this.state.selectedObjects.length > 1) {
      this.root.innerHTML = `<h2>Properties</h2><p class="empty">${this.state.selectedObjects.length} objects selected. Drag them in the scene to move them together.</p>`;
      return;
    }

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
      ${object.type === "sprite" ? this.spriteFields(object) : ""}
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
    this.bindSpriteAssetInputs(object);
    this.bindSpriteInputs(object);
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

  private bindSpriteInputs(object: SceneObject): void {
    this.root.querySelectorAll<HTMLInputElement>("[data-sprite-prop]").forEach((input) => {
      input.addEventListener("change", () => {
        const prop = input.dataset.spriteProp as keyof NonNullable<SceneObject["sprite"]>;
        const current = object.sprite ?? this.defaultSprite();
        const value = input.type === "number" ? Number(input.value) : input.type === "checkbox" ? input.checked : input.value;
        this.state.updateObject(object.id, { sprite: { ...current, [prop]: value } });
      });
    });
  }

  private bindSpriteAssetInputs(object: SceneObject): void {
    const picker = this.root.querySelector<HTMLSelectElement>("[data-sprite-asset]");
    picker?.addEventListener("change", () => {
      const current = object.sprite ?? this.defaultSprite();
      const asset = this.getAssets().find((item) => item.id === picker.value);
      this.state.updateObject(object.id, {
        sprite: {
          ...current,
          assetId: asset?.id ?? "",
          imageUrl: asset?.url ?? "",
          sheetUrl: asset ? "" : current.sheetUrl
        }
      });
    });

    const fileInput = this.root.querySelector<HTMLInputElement>("[data-sprite-image-file]");
    this.root.querySelector<HTMLButtonElement>("[data-upload-sprite-image]")?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const asset = await this.onUploadImage(file);
      fileInput.value = "";
      if (!asset) return;
      const current = object.sprite ?? this.defaultSprite();
      this.state.updateObject(object.id, {
        sprite: {
          ...current,
          assetId: asset.id,
          imageUrl: asset.url,
          sheetUrl: ""
        }
      });
    });

    this.root.querySelector<HTMLButtonElement>("[data-refresh-assets]")?.addEventListener("click", () => void this.onRefreshAssets());
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

  private spriteFields(object: SceneObject): string {
    const sprite = object.sprite ?? this.defaultSprite();
    const assets = this.getAssets();
    return `
      <h3>Sprite</h3>
      <label class="field">
        <span>Image asset</span>
        <select data-sprite-asset>
          <option value="">No uploaded asset</option>
          ${assets.map((asset) => `<option value="${this.escape(asset.id)}" ${sprite.assetId === asset.id ? "selected" : ""}>${this.escape(asset.name)}</option>`).join("")}
        </select>
      </label>
      <div class="asset-actions">
        <button type="button" data-upload-sprite-image>Upload PNG/JPG/WebP</button>
        <button type="button" data-refresh-assets>Refresh</button>
        <input data-sprite-image-file type="file" accept="image/png,image/jpeg,image/webp" />
      </div>
      <label class="field">
        <span>Direct Image URL</span>
        <input data-sprite-prop="imageUrl" value="${this.escape(sprite.imageUrl)}" placeholder="/api/assets/.../file or https://..." />
      </label>
      <label class="field">
        <span>Spritesheet JSON URL</span>
        <input data-sprite-prop="sheetUrl" value="${this.escape(sprite.sheetUrl)}" placeholder="https://.../spritesheet.json" />
      </label>
      <div class="inspector-grid">
        <label class="field">
          <span>Animation</span>
          <input data-sprite-prop="animation" value="${this.escape(sprite.animation)}" placeholder="idle" />
        </label>
        <label class="field">
          <span>Speed</span>
          <input type="number" step="0.01" data-sprite-prop="animationSpeed" value="${sprite.animationSpeed}" />
        </label>
      </div>
      <label class="checkbox-field">
        <input type="checkbox" data-sprite-prop="playing" ${sprite.playing ? "checked" : ""} />
        <span>Play animation</span>
      </label>
    `;
  }

  private defaultSprite(): NonNullable<SceneObject["sprite"]> {
    return { assetId: "", imageUrl: "", sheetUrl: "", animation: "", animationSpeed: 0.12, playing: true };
  }

  private escape(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
      return entities[char];
    });
  }
}
