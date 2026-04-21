import { createId, createScene, createSceneObject } from "../../shared/factory";
import type { ObjectType, Scene, SceneObject } from "../../shared/types";

type Listener = () => void;
interface HistorySnapshot {
  scene: Scene;
  selectedObjectIds: string[];
  gridSize: number;
  snapToGrid: boolean;
}

export class EditorState {
  private listeners = new Set<Listener>();
  private readonly undoStack: HistorySnapshot[] = [];
  private readonly redoStack: HistorySnapshot[] = [];
  private isRestoringHistory = false;
  private isBatchingHistory = false;
  private hasBatchHistory = false;
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
    this.recordHistory();
    this.scene = {
      ...scene,
      objects: [...scene.objects].sort((a, b) => a.zIndex - b.zIndex)
    };
    this.selectedObjectIds = this.scene.objects[0] ? [this.scene.objects[0].id] : [];
    this.emit();
  }

  setSceneName(name: string): void {
    this.recordHistory();
    this.scene = { ...this.scene, name, updatedAt: new Date().toISOString() };
    this.emit();
  }

  setSceneSize(size: Partial<Pick<Scene, "width" | "height">>): void {
    const width = this.clampSceneDimension(size.width ?? this.scene.width);
    const height = this.clampSceneDimension(size.height ?? this.scene.height);
    if (width === this.scene.width && height === this.scene.height) return;
    this.recordHistory();
    this.scene = { ...this.scene, width, height, updatedAt: new Date().toISOString() };
    this.emit();
  }

  previewSceneSize(size: Partial<Pick<Scene, "width" | "height">>): void {
    const width = this.clampSceneDimension(size.width ?? this.scene.width);
    const height = this.clampSceneDimension(size.height ?? this.scene.height);
    this.scene = { ...this.scene, width, height, updatedAt: new Date().toISOString() };
    this.emit();
  }

  previewSceneName(name: string): void {
    this.scene = { ...this.scene, name, updatedAt: new Date().toISOString() };
    this.emit();
  }

  setGridSize(size: number): void {
    this.recordHistory();
    this.gridSize = Math.max(4, Math.min(256, Math.round(size)));
    this.emit();
  }

  previewGridSize(size: number): void {
    this.gridSize = Math.max(4, Math.min(256, Math.round(size)));
    this.emit();
  }

  setSnapToGrid(enabled: boolean): void {
    this.recordHistory();
    this.snapToGrid = enabled;
    this.emit();
  }

  snapValue(value: number): number {
    if (!this.snapToGrid) return Math.round(value);
    return Math.round(value / this.gridSize) * this.gridSize;
  }

  addObject(type: ObjectType): void {
    this.recordHistory();
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
    this.recordHistory();
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
    if (!this.getObject(id)) return;
    this.recordHistory();
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
    this.recordHistory();
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
    if (!this.getObject(id)) return;
    this.recordHistory();
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
    if (patches.length === 0) return;
    this.recordHistory();
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

  beginHistoryBatch(): void {
    this.isBatchingHistory = true;
    this.hasBatchHistory = false;
  }

  endHistoryBatch(): void {
    this.isBatchingHistory = false;
    this.hasBatchHistory = false;
  }

  undo(): void {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return;
    this.redoStack.push(this.createSnapshot());
    this.restoreSnapshot(snapshot);
  }

  redo(): void {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return;
    this.undoStack.push(this.createSnapshot());
    this.restoreSnapshot(snapshot);
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private recordHistory(): void {
    if (this.isRestoringHistory) return;
    if (this.isBatchingHistory && this.hasBatchHistory) return;

    this.undoStack.push(this.createSnapshot());
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack.length = 0;
    this.hasBatchHistory = true;
  }

  private createSnapshot(): HistorySnapshot {
    return {
      scene: this.cloneScene(this.scene),
      selectedObjectIds: [...this.selectedObjectIds],
      gridSize: this.gridSize,
      snapToGrid: this.snapToGrid
    };
  }

  private restoreSnapshot(snapshot: HistorySnapshot): void {
    this.isRestoringHistory = true;
    this.scene = this.cloneScene(snapshot.scene);
    this.selectedObjectIds = [...snapshot.selectedObjectIds];
    this.gridSize = snapshot.gridSize;
    this.snapToGrid = snapshot.snapToGrid;
    this.isRestoringHistory = false;
    this.emit();
  }

  private cloneScene(scene: Scene): Scene {
    return {
      ...scene,
      objects: scene.objects.map((object) => ({
        ...object,
        physics: {
          ...object.physics,
          gravity: { ...object.physics.gravity },
          velocity: { ...object.physics.velocity }
        }
      }))
    };
  }

  private clampSceneDimension(value: number): number {
    return Math.max(64, Math.min(8192, Math.round(value)));
  }
}
