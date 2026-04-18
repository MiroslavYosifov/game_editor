# Web 2D Game Editor

A browser-based TypeScript editor for building and managing simple 2D scenes with PixiJS/WebGL rendering.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

The frontend is served by Vite. The Node backend runs on `http://127.0.0.1:3001` and stores scene data in `data/scenes.json`.

## Architecture

- `src/shared`: Serializable scene and object model shared by frontend and backend.
- `src/frontend/state`: Editor state, selection, tools, and object mutations.
- `src/frontend/rendering`: Canvas drawing and hit testing.
- `src/frontend/input`: Pointer interaction for selection, movement, and resizing.
- `src/frontend/ui`: DOM toolbar, hierarchy, inspector, and scene controls.
- `src/backend`: Node HTTP API for saving and loading scenes.

The PixiJS renderer never owns scene data. It reads from `EditorState`, creates WebGL display objects for the current frame, and exposes hit testing for editor input. Panels and input controllers mutate state through explicit methods. New object types can be added by extending the shared `ObjectType` union and adding renderer/property editor support.
