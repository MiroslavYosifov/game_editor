import { createScene, createSceneObject } from "../../shared/factory";
import type { EditorTool, ObjectType, Scene, SceneObject } from "../../shared/types";

type Listener = () => void;

export class EditorState {
  private listeners = new Set<Listener>();
  scene: Scene = createScene("New Scene");
  selectedObjectId: string | null = null;
  activeTool: EditorTool = "select";

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setScene(scene: Scene): void {
    this.scene = {
      ...scene,
      objects: [...scene.objects].sort((a, b) => a.zIndex - b.zIndex)
    };
    this.selectedObjectId = this.scene.objects[0]?.id ?? null;
    this.emit();
  }

  setSceneName(name: string): void {
    this.scene = { ...this.scene, name, updatedAt: new Date().toISOString() };
    this.emit();
  }

  setTool(tool: EditorTool): void {
    this.activeTool = tool;
    this.emit();
  }

  addObject(type: ObjectType): void {
    const object = createSceneObject(type, this.scene.objects.length + 1);
    this.scene = {
      ...this.scene,
      objects: [...this.scene.objects, object],
      updatedAt: new Date().toISOString()
    };
    this.selectedObjectId = object.id;
    this.emit();
  }

  selectObject(id: string | null): void {
    this.selectedObjectId = id;
    this.emit();
  }

  deleteSelected(): void {
    if (!this.selectedObjectId) return;
    this.scene = {
      ...this.scene,
      objects: this.scene.objects.filter((object) => object.id !== this.selectedObjectId),
      updatedAt: new Date().toISOString()
    };
    this.selectedObjectId = null;
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
    return this.selectedObjectId ? this.getObject(this.selectedObjectId) : null;
  }

  getObject(id: string): SceneObject | undefined {
    return this.scene.objects.find((object) => object.id === id);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
