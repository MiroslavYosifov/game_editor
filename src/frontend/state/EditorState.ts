import { createId, createScene, createSceneObject } from "../../shared/factory";
import type { ObjectType, Scene, SceneObject } from "../../shared/types";

type Listener = () => void;

export class EditorState {
  private listeners = new Set<Listener>();
  scene: Scene = createScene("New Scene");
  selectedObjectIds: string[] = [];
  private clipboardObjects: SceneObject[] = [];
  gridSize = 32;
  snapToGrid = false;

  get selectedObjectId(): string | null {
    return this.selectedObjectIds[0] ?? null;
  }

  set selectedObjectId(id: string | null) {
    this.selectedObjectIds = id ? [id] : [];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setScene(scene: Scene): void {
    this.scene = {
      ...scene,
      objects: [...scene.objects].sort((a, b) => a.zIndex - b.zIndex)
    };
    this.selectedObjectIds = this.scene.objects[0] ? [this.scene.objects[0].id] : [];
    this.emit();
  }

  setSceneName(name: string): void {
    this.scene = { ...this.scene, name, updatedAt: new Date().toISOString() };
    this.emit();
  }

  setGridSize(size: number): void {
    this.gridSize = Math.max(4, Math.min(256, Math.round(size)));
    this.emit();
  }

  setSnapToGrid(enabled: boolean): void {
    this.snapToGrid = enabled;
    this.emit();
  }

  snapValue(value: number): number {
    if (!this.snapToGrid) return Math.round(value);
    return Math.round(value / this.gridSize) * this.gridSize;
  }

  addObject(type: ObjectType): void {
    const object = createSceneObject(type, this.scene.objects.length + 1);
    this.scene = {
      ...this.scene,
      objects: [...this.scene.objects, object],
      updatedAt: new Date().toISOString()
    };
    this.selectedObjectIds = [object.id];
    this.emit();
  }

  selectObject(id: string | null): void {
    this.selectedObjectIds = id ? [id] : [];
    this.emit();
  }

  selectObjects(ids: string[]): void {
    const validIds = new Set(this.scene.objects.map((object) => object.id));
    this.selectedObjectIds = [...new Set(ids)].filter((id) => validIds.has(id));
    this.emit();
  }

  deleteSelected(): void {
    if (this.selectedObjectIds.length === 0) return;
    const selectedIds = new Set(this.selectedObjectIds);
    this.scene = {
      ...this.scene,
      objects: this.scene.objects.filter((object) => !selectedIds.has(object.id)),
      updatedAt: new Date().toISOString()
    };
    this.selectedObjectIds = [];
    this.emit();
  }

  deleteObject(id: string): void {
    this.scene = {
      ...this.scene,
      objects: this.scene.objects.filter((object) => object.id !== id),
      updatedAt: new Date().toISOString()
    };
    this.selectedObjectIds = this.selectedObjectIds.filter((selectedId) => selectedId !== id);
    this.emit();
  }

  copySelected(): void {
    this.clipboardObjects = this.selectedObjects.map((object) => ({ ...object, physics: { ...object.physics, gravity: { ...object.physics.gravity }, velocity: { ...object.physics.velocity } } }));
  }

  copyObject(id: string): void {
    const object = this.getObject(id);
    if (!object) return;
    this.clipboardObjects = [{ ...object, physics: { ...object.physics, gravity: { ...object.physics.gravity }, velocity: { ...object.physics.velocity } } }];
    this.selectedObjectIds = [id];
    this.emit();
  }

  duplicateObject(id: string): void {
    this.copyObject(id);
    this.pasteObjects();
  }

  pasteObjects(): void {
    if (this.clipboardObjects.length === 0) return;
    const offset = this.snapToGrid ? this.gridSize : 20;
    const maxZ = this.scene.objects.reduce((max, object) => Math.max(max, object.zIndex), 0);
    const copies = this.clipboardObjects.map((object, index) => ({
      ...object,
      id: createId("object"),
      name: `${object.name} Copy`,
      x: this.snapValue(object.x + offset),
      y: this.snapValue(object.y + offset),
      zIndex: maxZ + index + 1,
      physics: {
        ...object.physics,
        gravity: { ...object.physics.gravity },
        velocity: { ...object.physics.velocity }
      }
    }));

    this.scene = {
      ...this.scene,
      objects: [...this.scene.objects, ...copies].sort((a, b) => a.zIndex - b.zIndex),
      updatedAt: new Date().toISOString()
    };
    this.selectedObjectIds = copies.map((object) => object.id);
    this.clipboardObjects = copies.map((object) => ({ ...object, physics: { ...object.physics, gravity: { ...object.physics.gravity }, velocity: { ...object.physics.velocity } } }));
    this.emit();
  }

  updateSelected(patch: Partial<SceneObject>): void {
    if (!this.selectedObjectId) return;
    this.updateObject(this.selectedObjectId, patch);
  }

  updateObject(id: string, patch: Partial<SceneObject>): void {
    this.scene = {
      ...this.scene,
      objects: this.scene.objects
        .map((object) => (object.id === id ? { ...object, ...patch } : object))
        .sort((a, b) => a.zIndex - b.zIndex),
      updatedAt: new Date().toISOString()
    };
    this.emit();
  }

  updateObjects(patches: Array<{ id: string; patch: Partial<SceneObject> }>): void {
    const patchById = new Map(patches.map((item) => [item.id, item.patch]));
    this.scene = {
      ...this.scene,
      objects: this.scene.objects
        .map((object) => {
          const patch = patchById.get(object.id);
          return patch ? { ...object, ...patch } : object;
        })
        .sort((a, b) => a.zIndex - b.zIndex),
      updatedAt: new Date().toISOString()
    };
    this.emit();
  }

  updatePhysics(id: string, patch: Partial<SceneObject["physics"]>): void {
    const object = this.getObject(id);
    if (!object) return;
    this.updateObject(id, { physics: { ...object.physics, ...patch } });
  }

  updateGravity(id: string, patch: Partial<SceneObject["physics"]["gravity"]>): void {
    const object = this.getObject(id);
    if (!object) return;
    this.updatePhysics(id, { gravity: { ...object.physics.gravity, ...patch } });
  }

  updateVelocity(id: string, patch: Partial<SceneObject["physics"]["velocity"]>): void {
    const object = this.getObject(id);
    if (!object) return;
    this.updatePhysics(id, { velocity: { ...object.physics.velocity, ...patch } });
  }

  get selectedObject(): SceneObject | null {
    return this.selectedObjectId ? (this.getObject(this.selectedObjectId) ?? null) : null;
  }

  get selectedObjects(): SceneObject[] {
    const selectedIds = new Set(this.selectedObjectIds);
    return this.scene.objects.filter((object) => selectedIds.has(object.id));
  }

  isSelected(id: string): boolean {
    return this.selectedObjectIds.includes(id);
  }

  getObject(id: string): SceneObject | undefined {
    return this.scene.objects.find((object) => object.id === id);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
