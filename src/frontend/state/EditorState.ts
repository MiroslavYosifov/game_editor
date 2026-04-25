import { createScene, createSceneObject } from "../../shared/factory";
import type { ObjectType, Scene, SceneObject } from "../../shared/types";
import { createClipboard, createPastedObjects } from "./editorState/clipboard";
import {
  pushHistorySnapshot,
  shouldRecordHistory,
  takeRedoSnapshot,
  takeUndoSnapshot,
  type HistorySnapshot
} from "./editorState/history";
import {
  clampSceneDimension,
  cloneObject,
  cloneScene,
  patchObject,
  patchObjects,
  removeObject,
  removeObjects,
  sortByZIndex,
  withUpdatedAt
} from "./editorState/sceneMutations";

type Listener = () => void;

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
      objects: sortByZIndex(scene.objects)
    };
    this.selectedObjectIds = this.scene.objects[0] ? [this.scene.objects[0].id] : [];
    this.emit();
  }

  setSceneName(name: string): void {
    this.recordHistory();
    this.scene = withUpdatedAt(this.scene, { name });
    this.emit();
  }

  setSceneSize(size: Partial<Pick<Scene, "width" | "height">>): void {
    const width = clampSceneDimension(size.width ?? this.scene.width);
    const height = clampSceneDimension(size.height ?? this.scene.height);
    if (width === this.scene.width && height === this.scene.height) return;
    this.recordHistory();
    this.scene = withUpdatedAt(this.scene, { width, height });
    this.emit();
  }

  previewSceneSize(size: Partial<Pick<Scene, "width" | "height">>): void {
    const width = clampSceneDimension(size.width ?? this.scene.width);
    const height = clampSceneDimension(size.height ?? this.scene.height);
    this.scene = withUpdatedAt(this.scene, { width, height });
    this.emit();
  }

  previewSceneName(name: string): void {
    this.scene = withUpdatedAt(this.scene, { name });
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
      ...withUpdatedAt(this.scene, {}),
      objects: [...this.scene.objects, object]
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
    this.scene = removeObjects(this.scene, selectedIds);
    this.selectedObjectIds = [];
    this.emit();
  }

  deleteObject(id: string): void {
    if (!this.getObject(id)) return;
    this.recordHistory();
    this.scene = removeObject(this.scene, id);
    this.selectedObjectIds = this.selectedObjectIds.filter((selectedId) => selectedId !== id);
    this.emit();
  }

  copySelected(): void {
    this.clipboardObjects = createClipboard(this.selectedObjects);
  }

  copyObject(id: string): void {
    const object = this.getObject(id);
    if (!object) return;
    this.clipboardObjects = createClipboard([object]);
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
    const copies = createPastedObjects(this.clipboardObjects, this.scene, (value) => this.snapValue(value), this.snapToGrid, this.gridSize);

    this.scene = {
      ...withUpdatedAt(this.scene, {}),
      objects: sortByZIndex([...this.scene.objects, ...copies])
    };
    this.selectedObjectIds = copies.map((object) => object.id);
    this.clipboardObjects = createClipboard(copies);
    this.emit();
  }

  updateSelected(patch: Partial<SceneObject>): void {
    if (!this.selectedObjectId) return;
    this.updateObject(this.selectedObjectId, patch);
  }

  updateObject(id: string, patch: Partial<SceneObject>): void {
    if (!this.getObject(id)) return;
    this.recordHistory();
    this.scene = patchObject(this.scene, id, patch);
    this.emit();
  }

  updateObjects(patches: Array<{ id: string; patch: Partial<SceneObject> }>): void {
    if (patches.length === 0) return;
    this.recordHistory();
    this.scene = patchObjects(this.scene, patches);
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

  toggleObjectLocked(id: string): void {
    const object = this.getObject(id);
    if (!object) return;
    this.updateObject(id, { locked: !object.locked });
  }

  toggleObjectHidden(id: string): void {
    const object = this.getObject(id);
    if (!object) return;
    this.updateObject(id, { hidden: !object.hidden });
  }

  alignSelected(mode: "left" | "center" | "right" | "top" | "middle" | "bottom"): void {
    const selected = this.selectedObjects.filter((object) => !object.locked);
    if (selected.length < 2) return;

    const left = Math.min(...selected.map((object) => object.x));
    const right = Math.max(...selected.map((object) => object.x + object.width));
    const top = Math.min(...selected.map((object) => object.y));
    const bottom = Math.max(...selected.map((object) => object.y + object.height));
    const center = (left + right) / 2;
    const middle = (top + bottom) / 2;

    this.updateObjects(
      selected.map((object) => ({
        id: object.id,
        patch:
          mode === "left"
            ? { x: this.snapValue(left) }
            : mode === "center"
              ? { x: this.snapValue(center - object.width / 2) }
              : mode === "right"
                ? { x: this.snapValue(right - object.width) }
                : mode === "top"
                  ? { y: this.snapValue(top) }
                  : mode === "middle"
                    ? { y: this.snapValue(middle - object.height / 2) }
                    : { y: this.snapValue(bottom - object.height) }
      }))
    );
  }

  distributeSelected(axis: "horizontal" | "vertical"): void {
    const selected = this.selectedObjects.filter((object) => !object.locked);
    if (selected.length < 3) return;

    const sorted =
      axis === "horizontal"
        ? [...selected].sort((a, b) => a.x - b.x)
        : [...selected].sort((a, b) => a.y - b.y);

    const start = axis === "horizontal" ? sorted[0].x : sorted[0].y;
    const endObject = sorted[sorted.length - 1];
    const end = axis === "horizontal" ? endObject.x : endObject.y;
    const step = (end - start) / (sorted.length - 1);

    this.updateObjects(
      sorted.map((object, index) => ({
        id: object.id,
        patch: axis === "horizontal" ? { x: this.snapValue(start + step * index) } : { y: this.snapValue(start + step * index) }
      }))
    );
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
    const snapshot = takeUndoSnapshot(this.undoStack, this.redoStack, this.createSnapshot());
    if (!snapshot) return;
    this.restoreSnapshot(snapshot);
  }

  redo(): void {
    const snapshot = takeRedoSnapshot(this.undoStack, this.redoStack, this.createSnapshot());
    if (!snapshot) return;
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
    if (
      !shouldRecordHistory({
        isRestoringHistory: this.isRestoringHistory,
        isBatchingHistory: this.isBatchingHistory,
        hasBatchHistory: this.hasBatchHistory
      })
    ) {
      return;
    }
    pushHistorySnapshot(this.undoStack, this.redoStack, this.createSnapshot());
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
    return cloneScene(scene);
  }

  private cloneObject(object: SceneObject): SceneObject {
    return cloneObject(object);
  }

  private clampSceneDimension(value: number): number {
    return clampSceneDimension(value);
  }
}
