import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createScene } from "../shared/factory";
import type { Scene, SceneSummary } from "../shared/types";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";
const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const dataFile = join(root, "data", "scenes.json");
const distDir = join(root, "dist");

interface SceneStore {
  scenes: Scene[];
}

const server = createServer(async (request, response) => {
  try {
    await route(request, response);
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "Unknown server error" });
  }
});

server.listen(port, host, () => {
  console.log(`Scene API running at http://${host}:${port}`);
});

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

  if (request.method === "OPTIONS") {
    sendCors(response);
    response.writeHead(204);
    response.end();
    return;
  }

  if (url.pathname === "/api/scenes" && request.method === "GET") {
    const store = await readStore();
    const summaries: SceneSummary[] = store.scenes.map((scene) => ({
      id: scene.id,
      name: scene.name,
      objectCount: scene.objects.length,
      updatedAt: scene.updatedAt
    }));
    sendJson(response, 200, summaries);
    return;
  }

  if (url.pathname === "/api/scenes" && request.method === "POST") {
    const scene = createScene("New Scene");
    const store = await readStore();
    store.scenes.unshift(scene);
    await writeStore(store);
    sendJson(response, 201, scene);
    return;
  }

  const sceneMatch = url.pathname.match(/^\/api\/scenes\/([^/]+)$/);
  if (sceneMatch) {
    const sceneId = decodeURIComponent(sceneMatch[1]);
    if (request.method === "GET") {
      const store = await readStore();
      const scene = store.scenes.find((item) => item.id === sceneId);
      if (!scene) return sendJson(response, 404, { error: "Scene not found" });
      sendJson(response, 200, scene);
      return;
    }

    if (request.method === "PUT") {
      const scene = await readJson<Scene>(request);
      const now = new Date().toISOString();
      const nextScene = { ...scene, id: sceneId, updatedAt: now };
      const store = await readStore();
      const index = store.scenes.findIndex((item) => item.id === sceneId);
      if (index >= 0) store.scenes[index] = nextScene;
      else store.scenes.unshift(nextScene);
      await writeStore(store);
      sendJson(response, 200, nextScene);
      return;
    }

    if (request.method === "DELETE") {
      const store = await readStore();
      await writeStore({ scenes: store.scenes.filter((scene) => scene.id !== sceneId) });
      sendJson(response, 204, null);
      return;
    }
  }

  if (request.method === "GET" || request.method === "HEAD") {
    await sendStaticFile(response, url.pathname);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

async function readStore(): Promise<SceneStore> {
  try {
    const raw = await readFile(dataFile, "utf8");
    return JSON.parse(raw) as SceneStore;
  } catch {
    const initial: SceneStore = { scenes: [createScene("Starter Scene")] };
    await writeStore(initial);
    return initial;
  }
}

async function writeStore(store: SceneStore): Promise<void> {
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function sendCors(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  sendCors(response);
  response.statusCode = status;
  if (status === 204) {
    response.end();
    return;
  }
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

async function sendStaticFile(response: ServerResponse, pathname: string): Promise<void> {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const staticPath = resolve(distDir, `.${decodeURIComponent(requestedPath)}`);
  const isInsideDist = staticPath === distDir || staticPath.startsWith(`${distDir}${sep}`);

  if (!isInsideDist) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const file = await readFile(staticPath);
    response.statusCode = 200;
    response.setHeader("Content-Type", getContentType(staticPath));
    response.end(file);
  } catch {
    try {
      const index = await readFile(join(distDir, "index.html"));
      response.statusCode = 200;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(index);
    } catch {
      sendJson(response, 404, { error: "Frontend build not found. Run npm run build first." });
    }
  }
}

function getContentType(filePath: string): string {
  switch (extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".wasm":
      return "application/wasm";
    default:
      return "application/octet-stream";
  }
}
