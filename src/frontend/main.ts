import { createScene } from "../shared/factory";
import "./styles.css";
import { AssetApi } from "./api/AssetApi";
import { SceneApi } from "./api/SceneApi";
import { createExamplePlatformScene } from "./examples/examplePlatformScene";
import { PointerController } from "./input/PointerController";
import { PixiRenderer } from "./rendering/PixiRenderer";
import { EditorState } from "./state/EditorState";
import { HierarchyPanel } from "./ui/HierarchyPanel";
import { InspectorPanel } from "./ui/InspectorPanel";
import { Toolbar } from "./ui/Toolbar";
import type { AssetSummary, SceneSummary } from "../shared/types";

const log = {
  info: (message: string, data?: unknown): void => console.info(`[GameEditor] ${message}`, data ?? ""),
  warn: (message: string, data?: unknown): void => console.warn(`[GameEditor] ${message}`, data ?? ""),
  error: (message: string, data?: unknown): void => console.error(`[GameEditor] ${message}`, data ?? "")
};

log.info("Page script started");

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root is missing.");

app.innerHTML = `
  <div class="editor-shell">
    <header id="toolbar" class="toolbar"></header>
    <aside id="hierarchy" class="panel left-panel"></aside>
    <main class="viewport-stage" id="scene-viewport">
      <div id="status" class="status">Ready</div>
    </main>
    <aside id="inspector" class="panel right-panel"></aside>
  </div>
`;

const state = new EditorState();
const api = new SceneApi();
const assetApi = new AssetApi();
let sceneSummaries: SceneSummary[] = [];
let assetSummaries: AssetSummary[] = [];
let imageUploadInProgress = false;
let spritesheetUploadInProgress = false;
const viewport = document.querySelector<HTMLElement>("#scene-viewport");
const toolbarRoot = document.querySelector<HTMLElement>("#toolbar");
const hierarchyRoot = document.querySelector<HTMLElement>("#hierarchy");
const inspectorRoot = document.querySelector<HTMLElement>("#inspector");
const statusRoot = document.querySelector<HTMLElement>("#status");

if (!viewport || !toolbarRoot || !hierarchyRoot || !inspectorRoot || !statusRoot) {
  throw new Error("Editor DOM did not initialize.");
}

const renderer = new PixiRenderer(viewport, state);
new PointerController(renderer.view, state, renderer);

const setStatus = (message: string): void => {
  log.info(`Status: ${message}`);
  statusRoot.textContent = message;
};

const hierarchy = new HierarchyPanel(hierarchyRoot, state);

const getPreferredHeroAsset = (): AssetSummary | undefined =>
  assetSummaries.find((asset) => asset.type === "spritesheet") ?? assetSummaries.find((asset) => asset.type === "image");

const refreshAssets = async (): Promise<void> => {
  log.info("Refreshing asset list");
  try {
    assetSummaries = dedupeAssets(await assetApi.listAssets());
    log.info("Asset list loaded", { count: assetSummaries.length, assets: assetSummaries });
    inspector.render();
  } catch (error) {
    log.warn("Asset list unavailable", error);
    assetSummaries = [];
    inspector.render();
  }
};

const uploadImageAsset = async (file: File): Promise<AssetSummary | null> => {
  if (imageUploadInProgress) return null;
  imageUploadInProgress = true;
  log.info("Uploading image asset", { name: file.name, type: file.type, size: file.size });
  try {
    const asset = await assetApi.uploadImage(file);
    assetSummaries = dedupeAssets([asset, ...assetSummaries]);
    log.info("Image asset uploaded", asset);
    setStatus(`Uploaded ${asset.name}`);
    inspector.render();
    return asset;
  } catch (error) {
    log.error("Image asset upload failed", error);
    setStatus(error instanceof Error ? error.message : "Image upload failed");
    return null;
  } finally {
    imageUploadInProgress = false;
  }
};

const uploadSpritesheetAsset = async (image: File, json: File): Promise<AssetSummary | null> => {
  if (spritesheetUploadInProgress) return null;
  spritesheetUploadInProgress = true;
  log.info("Uploading spritesheet asset", { image: image.name, json: json.name, size: image.size });
  try {
    const asset = await assetApi.uploadSpritesheet(image, json);
    assetSummaries = dedupeAssets([asset, ...assetSummaries]);
    log.info("Spritesheet asset uploaded", asset);
    setStatus(`Uploaded spritesheet ${asset.name}`);
    inspector.render();
    return asset;
  } catch (error) {
    log.error("Spritesheet upload failed", error);
    setStatus(error instanceof Error ? error.message : "Spritesheet upload failed");
    return null;
  } finally {
    spritesheetUploadInProgress = false;
  }
};

const dedupeAssets = (assets: AssetSummary[]): AssetSummary[] => {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    const key = `${asset.type}|${asset.name}|${asset.frameNames?.length ?? 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const inspector = new InspectorPanel(
  inspectorRoot,
  state,
  () => assetSummaries,
  uploadImageAsset,
  uploadSpritesheetAsset,
  refreshAssets
);

const refreshScenes = async (): Promise<void> => {
  log.info("Refreshing saved scene list");
  try {
    sceneSummaries = await api.listScenes();
    log.info("Saved scene list loaded", { count: sceneSummaries.length, scenes: sceneSummaries });
    toolbar.render();
    setStatus(`Found ${sceneSummaries.length} saved scenes`);
  } catch (error) {
    log.warn("Saved scene list unavailable", error);
    sceneSummaries = [];
    toolbar.render();
    setStatus("Scene list unavailable. Example scene is still available.");
  }
};

const loadScene = async (sceneId: string): Promise<void> => {
  log.info("Loading scene", { sceneId });
  try {
    if (sceneId === "example-snake-scene") {
      state.setScene(createExamplePlatformScene(getPreferredHeroAsset()));
      log.info("Built-in Sprite Maze scene loaded");
      setStatus("Loaded Sprite Maze Scene");
      return;
    }

    const scene = await api.loadScene(sceneId);
    state.setScene(scene);
    log.info("Saved scene loaded", { id: scene.id, name: scene.name, objectCount: scene.objects.length });
    setStatus(`Loaded ${scene.name}`);
  } catch (error) {
    log.error("Scene load failed", error);
    setStatus(error instanceof Error ? error.message : "Load failed");
  }
};

const toolbar = new Toolbar(
  toolbarRoot,
  state,
  () => sceneSummaries,
  (sceneId) => void loadScene(sceneId),
  () => void refreshScenes(),
  async () => {
    log.info("Saving current scene", { id: state.scene.id, name: state.scene.name, objectCount: state.scene.objects.length });
    try {
      const saved = await api.saveScene(state.scene);
      state.setScene(saved);
      sceneSummaries = await api.listScenes();
      log.info("Scene saved", { id: saved.id, name: saved.name, objectCount: saved.objects.length });
      setStatus(`Saved ${saved.name}`);
    } catch (error) {
      log.error("Scene save failed", error);
      setStatus(error instanceof Error ? error.message : "Save failed");
    }
  },
  () => {
    log.info("Creating new scene");
    state.setScene(createScene("New Scene"));
    setStatus("Created new scene");
  }
);

state.subscribe(() => {
  if (!toolbarRoot.querySelector("[data-grid-size]:focus, [data-scene-width]:focus, [data-scene-height]:focus")) toolbar.render();
  if (!hierarchyRoot.querySelector("[data-scene-name]:focus")) hierarchy.render();
  inspector.render();
  renderer.render();
});

async function boot(): Promise<void> {
  const startedAt = performance.now();
  log.info("Boot started");
  toolbar.render();
  hierarchy.render();
  inspector.render();
  renderer.render();

  try {
    log.info("Loading asset list during boot");
    assetSummaries = dedupeAssets(await assetApi.listAssets());
    log.info("Boot asset list loaded", { count: assetSummaries.length });
  } catch (error) {
    log.warn("Boot asset list unavailable", error);
    assetSummaries = [];
  }

  state.setScene(createExamplePlatformScene(getPreferredHeroAsset()));
  log.info("Default Sprite Maze scene loaded");
  setStatus("Loaded Sprite Maze Scene");

  try {
    log.info("Loading saved scenes during boot");
    sceneSummaries = await api.listScenes();
    log.info("Boot scene list loaded", { count: sceneSummaries.length });
    toolbar.render();
  } catch (error) {
    log.warn("Boot scene list unavailable", error);
    setStatus("Loaded Sprite Maze Scene. Backend unavailable until save is available.");
  } finally {
    log.info("Boot finished", { durationMs: Math.round(performance.now() - startedAt) });
  }
}

void boot();
