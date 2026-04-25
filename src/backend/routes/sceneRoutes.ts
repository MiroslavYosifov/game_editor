import type { IncomingMessage, ServerResponse } from "node:http";
import { createScene } from "../../shared/factory";
import type { Scene } from "../../shared/types";
import { readJson, sendJson } from "../infra/http";
import type { SceneService } from "../services/sceneService";
import { ERROR_SCENE_NOT_FOUND } from "./responses";

export async function handleSceneRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  sceneService: SceneService
): Promise<boolean> {
  if (pathname === "/api/scenes" && request.method === "GET") {
    const summaries = await sceneService.listScenes();
    sendJson(response, 200, summaries);
    return true;
  }

  if (pathname === "/api/scenes" && request.method === "POST") {
    const scene = createScene("New Scene");
    const saved = await sceneService.saveScene(scene.id, scene);
    sendJson(response, 201, saved);
    return true;
  }

  const sceneMatch = pathname.match(/^\/api\/scenes\/([^/]+)$/);
  if (!sceneMatch) return false;

  const sceneId = decodeURIComponent(sceneMatch[1]);
  if (request.method === "GET") {
    const scene = await sceneService.loadScene(sceneId);
    if (!scene) {
      sendJson(response, 404, ERROR_SCENE_NOT_FOUND);
      return true;
    }
    sendJson(response, 200, scene);
    return true;
  }

  if (request.method === "PUT") {
    const scene = await readJson<Scene>(request);
    const now = new Date().toISOString();
    const nextScene = { ...scene, id: sceneId, updatedAt: now };
    const saved = await sceneService.saveScene(sceneId, nextScene);
    sendJson(response, 200, saved);
    return true;
  }

  if (request.method === "DELETE") {
    await sceneService.deleteScene(sceneId);
    sendJson(response, 204, null);
    return true;
  }

  return false;
}
