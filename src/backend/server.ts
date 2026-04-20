import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createScene } from "../shared/factory";
import type { AssetSummary, Scene, SceneSummary } from "../shared/types";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
await loadEnvFile(join(root, ".env"));

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";
const dataFile = join(root, "data", "scenes.json");
const distDir = join(root, "dist");
const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "assets";
const usingSupabase = Boolean(supabaseUrl && supabaseKey);

interface SceneStore {
  scenes: Scene[];
}

interface SceneRow {
  id: string;
  name: string;
  data: Scene;
  updated_at: string;
}

interface AssetRow {
  id: string;
  name: string;
  type: "image";
  storage_path: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
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
  console.log(usingSupabase ? "Scene storage: Supabase" : "Scene storage: local data/scenes.json");
});

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

  if (request.method === "OPTIONS") {
    sendCors(response);
    response.writeHead(204);
    response.end();
    return;
  }

  if (url.pathname === "/api/assets" && request.method === "GET") {
    const assets = await listAssets();
    sendJson(response, 200, assets);
    return;
  }

  if (url.pathname === "/api/assets/image" && request.method === "POST") {
    const asset = await uploadImageAsset(request);
    sendJson(response, 201, asset);
    return;
  }

  const assetFileMatch = url.pathname.match(/^\/api\/assets\/([^/]+)\/file(?:\/.*)?$/);
  if (assetFileMatch && request.method === "GET") {
    await sendAssetFile(response, decodeURIComponent(assetFileMatch[1]));
    return;
  }

  if (url.pathname === "/api/scenes" && request.method === "GET") {
    const summaries = await listScenes();
    sendJson(response, 200, summaries);
    return;
  }

  if (url.pathname === "/api/scenes" && request.method === "POST") {
    const scene = createScene("New Scene");
    const saved = await saveScene(scene.id, scene);
    sendJson(response, 201, saved);
    return;
  }

  const sceneMatch = url.pathname.match(/^\/api\/scenes\/([^/]+)$/);
  if (sceneMatch) {
    const sceneId = decodeURIComponent(sceneMatch[1]);
    if (request.method === "GET") {
      const scene = await loadScene(sceneId);
      if (!scene) return sendJson(response, 404, { error: "Scene not found" });
      sendJson(response, 200, scene);
      return;
    }

    if (request.method === "PUT") {
      const scene = await readJson<Scene>(request);
      const now = new Date().toISOString();
      const nextScene = { ...scene, id: sceneId, updatedAt: now };
      const saved = await saveScene(sceneId, nextScene);
      sendJson(response, 200, saved);
      return;
    }

    if (request.method === "DELETE") {
      await deleteScene(sceneId);
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

async function listScenes(): Promise<SceneSummary[]> {
  if (!usingSupabase) {
    const store = await readStore();
    return store.scenes.map(toSceneSummary);
  }

  const rows = await supabaseRequest<SceneRow[]>("/rest/v1/scenes?select=id,name,data,updated_at&order=updated_at.desc");
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    objectCount: row.data.objects.length,
    updatedAt: row.updated_at
  }));
}

async function loadScene(id: string): Promise<Scene | null> {
  if (!usingSupabase) {
    const store = await readStore();
    return store.scenes.find((scene) => scene.id === id) ?? null;
  }

  const rows = await supabaseRequest<SceneRow[]>(`/rest/v1/scenes?id=eq.${encodeURIComponent(id)}&select=id,name,data,updated_at&limit=1`);
  return rows[0]?.data ?? null;
}

async function saveScene(id: string, scene: Scene): Promise<Scene> {
  if (!usingSupabase) {
    const store = await readStore();
    const index = store.scenes.findIndex((item) => item.id === id);
    if (index >= 0) store.scenes[index] = scene;
    else store.scenes.unshift(scene);
    await writeStore(store);
    return scene;
  }

  const rows = await supabaseRequest<SceneRow[]>("/rest/v1/scenes?on_conflict=id", {
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

async function deleteScene(id: string): Promise<void> {
  if (!usingSupabase) {
    const store = await readStore();
    await writeStore({ scenes: store.scenes.filter((scene) => scene.id !== id) });
    return;
  }

  await supabaseRequest<unknown>(`/rest/v1/scenes?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  });
}

async function listAssets(): Promise<AssetSummary[]> {
  ensureSupabaseAssets();
  const rows = await supabaseRequest<AssetRow[]>("/rest/v1/assets?select=id,name,type,storage_path,metadata,created_at&order=created_at.desc");
  return rows.map(toAssetSummary);
}

async function uploadImageAsset(request: IncomingMessage): Promise<AssetSummary> {
  ensureSupabaseAssets();

  const contentType = (request.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  const allowedTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
  if (!allowedTypes.has(contentType)) throw new Error("Only PNG, JPG, and WebP images can be uploaded.");

  const file = await readBuffer(request);
  if (!file.length) throw new Error("Upload file is empty.");

  const rawName = decodeURIComponent(String(request.headers["x-file-name"] ?? "sprite"));
  const safeName = sanitizeFileName(rawName);
  const storagePath = `images/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;

  await storageRequest(`/storage/v1/object/${storageBucket}/${encodeStoragePath(storagePath)}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "x-upsert": "false"
    },
    body: file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
  });

  const rows = await supabaseRequest<AssetRow[]>("/rest/v1/assets", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      name: safeName,
      type: "image",
      storage_path: storagePath,
      metadata: {
        contentType,
        size: file.length
      }
    })
  });

  const row = rows[0];
  if (!row) throw new Error("Asset uploaded, but asset metadata was not returned.");
  return toAssetSummary(row);
}

async function sendAssetFile(response: ServerResponse, id: string): Promise<void> {
  ensureSupabaseAssets();
  const rows = await supabaseRequest<AssetRow[]>(
    `/rest/v1/assets?id=eq.${encodeURIComponent(id)}&select=id,name,type,storage_path,metadata,created_at&limit=1`
  );
  const row = rows[0];
  if (!row) return sendJson(response, 404, { error: "Asset not found" });

  const signedUrl = await createSignedAssetUrl(row.storage_path);
  const assetResponse = await fetch(signedUrl);
  if (!assetResponse.ok) {
    const body = await assetResponse.text();
    throw new Error(`Asset file request failed: ${assetResponse.status} ${body}`);
  }

  sendCors(response);
  response.statusCode = 200;
  response.setHeader("Content-Type", String(row.metadata?.contentType ?? assetResponse.headers.get("content-type") ?? "application/octet-stream"));
  response.setHeader("Cache-Control", "private, max-age=300");
  response.end(Buffer.from(await assetResponse.arrayBuffer()));
}

async function createSignedAssetUrl(storagePath: string): Promise<string> {
  const result = await storageRequest<{ signedURL?: string; signedUrl?: string }>(
    `/storage/v1/object/sign/${storageBucket}/${encodeStoragePath(storagePath)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 300 })
    }
  );
  const signedPath = result.signedURL ?? result.signedUrl;
  if (!signedPath) throw new Error("Supabase did not return a signed asset URL.");
  return signedPath.startsWith("http") ? signedPath : `${supabaseUrl}/storage/v1${signedPath}`;
}

function toAssetSummary(row: AssetRow): AssetSummary {
  return {
    id: row.id,
    name: row.name,
    type: "image",
    storagePath: row.storage_path,
    url: `/api/assets/${encodeURIComponent(row.id)}/file/${encodeURIComponent(row.name)}`,
    createdAt: row.created_at
  };
}

function ensureSupabaseAssets(): void {
  if (!usingSupabase) throw new Error("Asset upload requires Supabase environment variables.");
}

function toSceneSummary(scene: Scene): SceneSummary {
  return {
    id: scene.id,
    name: scene.name,
    objectCount: scene.objects.length,
    updatedAt: scene.updatedAt
  };
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase environment variables are missing.");

  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: supabaseKey,
      "Content-Type": "application/json",
      ...getSupabaseAuthHeader(),
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${body}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function storageRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase environment variables are missing.");

  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: supabaseKey,
      ...getSupabaseAuthHeader(),
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase storage request failed: ${response.status} ${body}`);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function getSupabaseAuthHeader(): Record<string, string> {
  if (!supabaseKey || supabaseKey.startsWith("sb_secret_") || supabaseKey.startsWith("sb_publishable_")) return {};
  return { Authorization: `Bearer ${supabaseKey}` };
}

async function loadEnvFile(path: string): Promise<void> {
  try {
    const raw = await readFile(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator <= 0) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] ??= value;
    }
  } catch {
    // Render and other hosts provide environment variables directly.
  }
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  return JSON.parse((await readBuffer(request)).toString("utf8")) as T;
}

async function readBuffer(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function sendCors(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,X-File-Name");
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

function sanitizeFileName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
  return cleaned || "sprite.png";
}

function encodeStoragePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
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
