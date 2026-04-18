import { createScene } from "../shared/factory";
import "./styles.css";
import { SceneApi } from "./api/SceneApi";
import { createExamplePlatformScene } from "./examples/examplePlatformScene";
import { PointerController } from "./input/PointerController";
import { PixiRenderer } from "./rendering/PixiRenderer";
import { EditorState } from "./state/EditorState";
import { HierarchyPanel } from "./ui/HierarchyPanel";
import { InspectorPanel } from "./ui/InspectorPanel";
import { Toolbar } from "./ui/Toolbar";
import type { SceneSummary } from "../shared/types";

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
let sceneSummaries: SceneSummary[] = [];
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
const inspector = new InspectorPanel(inspectorRoot, state);

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
      state.setScene(createExamplePlatformScene());
      log.info("Built-in Snake scene loaded");
      setStatus("Loaded Snake Game Scene");
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
  if (!toolbarRoot.querySelector("[data-grid-size]:focus")) toolbar.render();
  hierarchy.render();
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

  state.setScene(createExamplePlatformScene());
  log.info("Default Snake scene loaded");
  setStatus("Loaded Snake Game Scene");

  try {
    log.info("Loading saved scenes during boot");
    sceneSummaries = await api.listScenes();
    log.info("Boot scene list loaded", { count: sceneSummaries.length });
    toolbar.render();
  } catch (error) {
    log.warn("Boot scene list unavailable", error);
    setStatus("Loaded Snake Game Scene. Backend unavailable until save is available.");
  } finally {
    log.info("Boot finished", { durationMs: Math.round(performance.now() - startedAt) });
  }
}

void boot();
