import type { IncomingMessage, ServerResponse } from "node:http";
import { sendCors, sendJson } from "../infra/http";
import type { AssetService } from "../services/assetService";
import type { SceneService } from "../services/sceneService";
import { sendStaticFile } from "../static/serveStatic";
import { handleAssetRoutes } from "./assetRoutes";
import { ERROR_ROUTE_NOT_FOUND } from "./responses";
import { handleSceneRoutes } from "./sceneRoutes";

interface AppRouterDependencies {
  assetService: AssetService;
  sceneService: SceneService;
  distDir: string;
}

export function createAppRouter(deps: AppRouterDependencies) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

    if (request.method === "OPTIONS") {
      sendCors(response);
      response.writeHead(204);
      response.end();
      return;
    }

    if (await handleAssetRoutes(request, response, url.pathname, deps.assetService)) {
      return;
    }

    if (await handleSceneRoutes(request, response, url.pathname, deps.sceneService)) {
      return;
    }

    if (request.method === "GET" || request.method === "HEAD") {
      await sendStaticFile(response, deps.distDir, url.pathname);
      return;
    }

    sendJson(response, 404, ERROR_ROUTE_NOT_FOUND);
  };
}
