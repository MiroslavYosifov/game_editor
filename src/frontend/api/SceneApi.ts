import type { Scene, SceneSummary } from "../../shared/types";

export class SceneApi {
  async listScenes(): Promise<SceneSummary[]> {
    const response = await fetch("/api/scenes");
    return this.parse<SceneSummary[]>(response);
  }

  async loadScene(id: string): Promise<Scene> {
    const response = await fetch(`/api/scenes/${id}`);
    return this.parse<Scene>(response);
  }

  async saveScene(scene: Scene): Promise<Scene> {
    const response = await fetch(`/api/scenes/${scene.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scene)
    });
    return this.parse<Scene>(response);
  }

  private async parse<T>(response: Response): Promise<T> {
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<T>;
  }
}
