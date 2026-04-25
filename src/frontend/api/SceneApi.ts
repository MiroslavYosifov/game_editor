import type { Scene, SceneSummary } from "../../shared/types";
import { requestJson } from "./http";

export class SceneApi {
  async listScenes(): Promise<SceneSummary[]> {
    return requestJson<SceneSummary[]>("/api/scenes");
  }

  async loadScene(id: string): Promise<Scene> {
    return requestJson<Scene>(`/api/scenes/${id}`);
  }

  async saveScene(scene: Scene): Promise<Scene> {
    return requestJson<Scene>(`/api/scenes/${scene.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scene)
    });
  }
}
