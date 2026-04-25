export interface EditorShellRefs {
  viewport: HTMLElement;
  toolbarRoot: HTMLElement;
  hierarchyRoot: HTMLElement;
  inspectorRoot: HTMLElement;
  statusRoot: HTMLElement;
}

export function createEditorShell(root: HTMLElement): EditorShellRefs {
  root.innerHTML = `
    <div class="editor-shell">
      <header id="toolbar" class="toolbar"></header>
      <aside id="hierarchy" class="panel left-panel"></aside>
      <main class="viewport-stage" id="scene-viewport">
        <div id="status" class="status">Ready</div>
      </main>
      <aside id="inspector" class="panel right-panel"></aside>
    </div>
  `;

  const viewport = root.querySelector<HTMLElement>("#scene-viewport");
  const toolbarRoot = root.querySelector<HTMLElement>("#toolbar");
  const hierarchyRoot = root.querySelector<HTMLElement>("#hierarchy");
  const inspectorRoot = root.querySelector<HTMLElement>("#inspector");
  const statusRoot = root.querySelector<HTMLElement>("#status");

  if (!viewport || !toolbarRoot || !hierarchyRoot || !inspectorRoot || !statusRoot) {
    throw new Error("Editor DOM did not initialize.");
  }

  return { viewport, toolbarRoot, hierarchyRoot, inspectorRoot, statusRoot };
}
