import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createScene } from "../../shared/factory";
import type { Scene, SceneSummary } from "../../shared/types";
import type { SupabaseClient } from "../infra/supabaseClient";

interface SceneStore {
  scenes: Scene[];
}

interface SceneRow {
  id: string;
  name: string;
  data: Scene;
  updated_at: string;
}

export class SceneService {
  constructor(
    private readonly dataFile: string,
    private readonly supabaseClient: SupabaseClient | null
  ) {}

  get usingSupabase(): boolean {
    return Boolean(this.supabaseClient);
  }

  async listScenes(): Promise<SceneSummary[]> {
    if (!this.supabaseClient) {
      const store = await this.readStore();
      return store.scenes.map(toSceneSummary);
    }

    const rows = await this.supabaseClient.request<SceneRow[]>("/rest/v1/scenes?select=id,name,data,updated_at&order=updated_at.desc");
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      objectCount: row.data.objects.length,
      updatedAt: row.updated_at
    }));
  }

  async loadScene(id: string): Promise<Scene | null> {
    if (!this.supabaseClient) {
      const store = await this.readStore();
      return store.scenes.find((scene) => scene.id === id) ?? null;
    }

    const rows = await this.supabaseClient.request<SceneRow[]>(
      `/rest/v1/scenes?id=eq.${encodeURIComponent(id)}&select=id,name,data,updated_at&limit=1`
    );
    return rows[0]?.data ?? null;
  }

  async saveScene(id: string, scene: Scene): Promise<Scene> {
    if (!this.supabaseClient) {
      const store = await this.readStore();
      const index = store.scenes.findIndex((item) => item.id === id);
      if (index >= 0) store.scenes[index] = scene;
      else store.scenes.unshift(scene);
      await this.writeStore(store);
      return scene;
    }

    const rows = await this.supabaseClient.request<SceneRow[]>("/rest/v1/scenes?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id,
        name: scene.name,
        data: scene,
        updated_at: scene.updatedAt
      })
    });
    return rows[0]?.data ?? scene;
  }

  async deleteScene(id: string): Promise<void> {
    if (!this.supabaseClient) {
      const store = await this.readStore();
      await this.writeStore({ scenes: store.scenes.filter((scene) => scene.id !== id) });
      return;
    }

    await this.supabaseClient.request<unknown>(`/rest/v1/scenes?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });
  }

  private async readStore(): Promise<SceneStore> {
    try {
      const raw = await readFile(this.dataFile, "utf8");
      return JSON.parse(raw) as SceneStore;
    } catch {
      const initial: SceneStore = { scenes: [createScene("Starter Scene")] };
      await this.writeStore(initial);
      return initial;
    }
  }

  private async writeStore(store: SceneStore): Promise<void> {
    await mkdir(dirname(this.dataFile), { recursive: true });
    await writeFile(this.dataFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }
}

function toSceneSummary(scene: Scene): SceneSummary {
  return {
    id: scene.id,
    name: scene.name,
    objectCount: scene.objects.length,
    updatedAt: scene.updatedAt
  };
}
