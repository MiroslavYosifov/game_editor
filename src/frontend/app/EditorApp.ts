import { createScene } from "../../shared/factory";
import type { AssetSummary, Scene, SceneSummary } from "../../shared/types";
import { AssetApi } from "../api/AssetApi";
import { SceneApi } from "../api/SceneApi";
import { PointerController } from "../input/PointerController";
import { PixiRenderer } from "../rendering/PixiRenderer";
import { EditorState } from "../state/EditorState";
import { HierarchyPanel } from "../ui/HierarchyPanel";
import { InspectorPanel } from "../ui/InspectorPanel";
import { Toolbar } from "../ui/Toolbar";
import { createEditorShell, type EditorShellRefs } from "./createEditorShell";

const log = {
  info: (message: string, data?: unknown): void => console.info(`[GameEditor] ${message}`, data ?? ""),
  warn: (message: string, data?: unknown): void => console.warn(`[GameEditor] ${message}`, data ?? ""),
  error: (message: string, data?: unknown): void => console.error(`[GameEditor] ${message}`, data ?? "")
};

export class EditorApp {
  private readonly state = new EditorState();
  private readonly sceneApi = new SceneApi();
  private readonly assetApi = new AssetApi();
  private readonly shell: EditorShellRefs;
  private readonly renderer: PixiRenderer;
  private readonly hierarchy: HierarchyPanel;
  private readonly inspector: InspectorPanel;
  private readonly toolbar: Toolbar;
  private sceneSummaries: SceneSummary[] = [];
  private assetSummaries: AssetSummary[] = [];
  private imageUploadInProgress = false;
  private spritesheetUploadInProgress = false;

  constructor(root: HTMLElement) {
    this.shell = createEditorShell(root);
    this.renderer = new PixiRenderer(this.shell.viewport, this.state);
    new PointerController(this.renderer.view, this.state, this.renderer);
    this.hierarchy = new HierarchyPanel(this.shell.hierarchyRoot, this.state);
    this.inspector = new InspectorPanel(
      this.shell.inspectorRoot,
      this.state,
      () => this.assetSummaries,
      (file) => this.uploadImageAsset(file),
      (image, json) => this.uploadSpritesheetAsset(image, json),
      () => this.refreshAssets()
    );
    this.toolbar = new Toolbar(
      this.shell.toolbarRoot,
      this.state,
      () => this.sceneSummaries,
      (sceneId) => void this.loadScene(sceneId),
      (sceneId) => void this.deleteScene(sceneId),
      () => void this.refreshScenes(),
      () => void this.saveScene(),
      () => this.createNewScene()
    );

    this.state.subscribe(() => {
      if (!this.shell.toolbarRoot.querySelector("[data-grid-size]:focus, [data-scene-width]:focus, [data-scene-height]:focus")) this.toolbar.render();
      if (!this.shell.hierarchyRoot.querySelector("[data-scene-name]:focus")) this.hierarchy.render();
      this.inspector.render();
      this.renderer.render();
    });
  }

  async boot(): Promise<void> {
    const startedAt = performance.now();
    log.info("Boot started");

    // Preserve the previous boot order exactly.
    this.toolbar.render();
    this.hierarchy.render();
    this.inspector.render();
    this.renderer.render();

    try {
      log.info("Loading asset list during boot");
      this.assetSummaries = this.dedupeAssets(await this.assetApi.listAssets());
      log.info("Boot asset list loaded", { count: this.assetSummaries.length });
    } catch (error) {
      log.warn("Boot asset list unavailable", error);
      this.assetSummaries = [];
    }

    try {
      log.info("Loading saved scenes during boot");
      this.sceneSummaries = await this.sceneApi.listScenes();
      log.info("Boot scene list loaded", { count: this.sceneSummaries.length });
      const firstScene = await this.loadInitialScene();
      if (firstScene) {
        this.state.setScene(firstScene);
        log.info("Default saved scene loaded", { id: firstScene.id, name: firstScene.name });
        this.setStatus(`Loaded ${firstScene.name}`);
      } else {
        this.setStatus("No saved scenes found. Create a new scene or import one.");
      }
      this.toolbar.render();
    } catch (error) {
      log.warn("Boot scene list unavailable", error);
      this.setStatus("Backend unavailable until saved scenes are available.");
    } finally {
      log.info("Boot finished", { durationMs: Math.round(performance.now() - startedAt) });
    }
  }

  private setStatus(message: string): void {
    log.info(`Status: ${message}`);
    this.shell.statusRoot.textContent = message;
  }

  private async refreshAssets(): Promise<void> {
    log.info("Refreshing asset list");
    try {
      this.assetSummaries = this.dedupeAssets(await this.assetApi.listAssets());
      log.info("Asset list loaded", { count: this.assetSummaries.length, assets: this.assetSummaries });
      this.inspector.render();
    } catch (error) {
      log.warn("Asset list unavailable", error);
      this.assetSummaries = [];
      this.inspector.render();
    }
  }

  private async uploadImageAsset(file: File): Promise<AssetSummary | null> {
    if (this.imageUploadInProgress) return null;
    this.imageUploadInProgress = true;
    log.info("Uploading image asset", { name: file.name, type: file.type, size: file.size });
    try {
      const asset = await this.assetApi.uploadImage(file);
      this.assetSummaries = this.dedupeAssets([asset, ...this.assetSummaries]);
      log.info("Image asset uploaded", asset);
      this.setStatus(`Uploaded ${asset.name}`);
      this.inspector.render();
      return asset;
    } catch (error) {
      log.error("Image asset upload failed", error);
      this.setStatus(error instanceof Error ? error.message : "Image upload failed");
      return null;
    } finally {
      this.imageUploadInProgress = false;
    }
  }

  private async uploadSpritesheetAsset(image: File, json: File): Promise<AssetSummary | null> {
    if (this.spritesheetUploadInProgress) return null;
    this.spritesheetUploadInProgress = true;
    log.info("Uploading spritesheet asset", { image: image.name, json: json.name, size: image.size });
    try {
      const asset = await this.assetApi.uploadSpritesheet(image, json);
      this.assetSummaries = this.dedupeAssets([asset, ...this.assetSummaries]);
      log.info("Spritesheet asset uploaded", asset);
      this.setStatus(`Uploaded spritesheet ${asset.name}`);
      this.inspector.render();
      return asset;
    } catch (error) {
      log.error("Spritesheet upload failed", error);
      this.setStatus(error instanceof Error ? error.message : "Spritesheet upload failed");
      return null;
    } finally {
      this.spritesheetUploadInProgress = false;
    }
  }

  private dedupeAssets(assets: AssetSummary[]): AssetSummary[] {
    const seen = new Set<string>();
    return assets.filter((asset) => {
      const key = `${asset.type}|${asset.name}|${asset.frameNames?.length ?? 0}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async refreshScenes(): Promise<void> {
    log.info("Refreshing saved scene list");
    try {
      this.sceneSummaries = await this.sceneApi.listScenes();
      log.info("Saved scene list loaded", { count: this.sceneSummaries.length, scenes: this.sceneSummaries });
      this.toolbar.render();
      this.setStatus(`Found ${this.sceneSummaries.length} saved scenes`);
    } catch (error) {
      log.warn("Saved scene list unavailable", error);
      this.sceneSummaries = [];
      this.toolbar.render();
      this.setStatus("Scene list unavailable.");
    }
  }

  private async loadScene(sceneId: string): Promise<void> {
    log.info("Loading scene", { sceneId });
    try {
      const scene = await this.sceneApi.loadScene(sceneId);
      this.state.setScene(scene);
      log.info("Saved scene loaded", { id: scene.id, name: scene.name, objectCount: scene.objects.length });
      this.setStatus(`Loaded ${scene.name}`);
    } catch (error) {
      log.error("Scene load failed", error);
      this.setStatus(error instanceof Error ? error.message : "Load failed");
    }
  }

  private async saveScene(): Promise<void> {
    log.info("Saving current scene", { id: this.state.scene.id, name: this.state.scene.name, objectCount: this.state.scene.objects.length });
    try {
      const saved = await this.sceneApi.saveScene(this.state.scene);
      this.state.setScene(saved);
      this.sceneSummaries = await this.sceneApi.listScenes();
      log.info("Scene saved", { id: saved.id, name: saved.name, objectCount: saved.objects.length });
      this.setStatus(`Saved ${saved.name}`);
    } catch (error) {
      log.error("Scene save failed", error);
      this.setStatus(error instanceof Error ? error.message : "Save failed");
    }
  }

  private createNewScene(): void {
    log.info("Creating new scene");
    this.state.setScene(createScene("New Scene"));
    this.setStatus("Created new scene");
  }

  private async deleteScene(sceneId: string): Promise<void> {
    const scene = this.sceneSummaries.find((item) => item.id === sceneId);
    if (!sceneId || !scene) return;
    if (!window.confirm(`Delete scene "${scene.name}"?`)) return;

    log.info("Deleting scene", { id: sceneId, name: scene.name });
    try {
      await this.sceneApi.deleteScene(sceneId);
      this.sceneSummaries = await this.sceneApi.listScenes();
      const nextScene = this.sceneSummaries[0] ? await this.sceneApi.loadScene(this.sceneSummaries[0].id) : null;

      if (nextScene) {
        this.state.setScene(nextScene);
        this.setStatus(`Deleted ${scene.name}. Loaded ${nextScene.name}`);
      } else {
        this.state.setScene(createScene("New Scene"));
        this.setStatus(`Deleted ${scene.name}. No saved scenes left.`);
      }

      this.toolbar.render();
    } catch (error) {
      log.error("Scene delete failed", error);
      this.setStatus(error instanceof Error ? error.message : "Delete failed");
    }
  }

  private async loadInitialScene(): Promise<Scene | null> {
    const firstSummary = this.sceneSummaries[0];
    if (!firstSummary) return null;
    return this.sceneApi.loadScene(firstSummary.id);
  }
}
