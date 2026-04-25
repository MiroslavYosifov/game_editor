import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toHttpError } from "./infra/errors";
import { loadEnvFile } from "./infra/env";
import { sendJson } from "./infra/http";
import { SupabaseClient, parseSupabaseConfig } from "./infra/supabaseClient";
import { createAppRouter } from "./routes/appRouter";
import { AssetService } from "./services/assetService";
import { SceneService } from "./services/sceneService";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
await loadEnvFile(join(root, ".env"));

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";
const dataFile = join(root, "data", "scenes.json");
const distDir = join(root, "dist");
const supabaseConfig = parseSupabaseConfig();
const supabaseClient = supabaseConfig ? new SupabaseClient(supabaseConfig) : null;
const sceneService = new SceneService(dataFile, supabaseClient);
const assetService = new AssetService(supabaseClient);
const route = createAppRouter({ assetService, sceneService, distDir });

const server = createServer(async (request, response) => {
  try {
    await route(request, response);
  } catch (error) {
    const httpError = toHttpError(error);
    sendJson(response, httpError.statusCode, { error: httpError.message });
  }
});

server.listen(port, host, () => {
  console.log(`Scene API running at http://${host}:${port}`);
  console.log(sceneService.usingSupabase ? "Scene storage: Supabase" : "Scene storage: local data/scenes.json");
});
