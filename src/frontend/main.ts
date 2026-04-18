import { createScene } from "../shared/factory";
import "./styles.css";
import { SceneApi } from "./api/SceneApi";
import { PointerController } from "./input/PointerController";
import { PixiRenderer } from "./rendering/PixiRenderer";
import { EditorState } from "./state/EditorState";
import { HierarchyPanel } from "./ui/HierarchyPanel";
import { InspectorPanel } from "./ui/InspectorPanel";
import { Toolbar } from "./ui/Toolbar";

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
  statusRoot.textContent = message;
};

const hierarchy = new HierarchyPanel(hierarchyRoot, state);
const inspector = new InspectorPanel(inspectorRoot, state);
const toolbar = new Toolbar(
  toolbarRoot,
  state,
  async () => {
    try {
      const saved = await api.saveScene(state.scene);
      state.setScene(saved);
      setStatus(`Saved ${saved.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
    }
  },
  () => {
    state.setScene(createScene("New Scene"));
    setStatus("Created new scene");
  }
);

state.subscribe(() => {
  toolbar.render();
  hierarchy.render();
  inspector.render();
  renderer.render();
});

async function boot(): Promise<void> {
  toolbar.render();
  hierarchy.render();
  inspector.render();
  renderer.render();

  try {
    const scenes = await api.listScenes();
    if (scenes[0]) {
      const scene = await api.loadScene(scenes[0].id);
      state.setScene(scene);
      setStatus(`Loaded ${scene.name}`);
    }
  } catch {
    setStatus("Backend unavailable. Editing locally until save is available.");
  }
}

void boot();
