import type { IncomingMessage, ServerResponse } from "node:http";
import type { AssetService } from "../services/assetService";
import { sendCors, sendJson } from "../infra/http";
import { ERROR_ASSET_NOT_FOUND, ERROR_SPRITESHEET_NOT_FOUND } from "./responses";

export async function handleAssetRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  assetService: AssetService
): Promise<boolean> {
  if (pathname === "/api/assets" && request.method === "GET") {
    const assets = await assetService.listAssets();
    sendJson(response, 200, assets);
    return true;
  }

  const assetDeleteMatch = pathname.match(/^\/api\/assets\/([^/]+)$/);
  if (assetDeleteMatch && request.method === "DELETE") {
    const deleted = await assetService.deleteAsset(decodeURIComponent(assetDeleteMatch[1]));
    if (!deleted) {
      sendJson(response, 404, ERROR_ASSET_NOT_FOUND);
      return true;
    }
    sendCors(response);
    response.statusCode = 204;
    response.end();
    return true;
  }

  if (pathname === "/api/assets/image" && request.method === "POST") {
    const asset = await assetService.uploadImageAsset(request);
    sendJson(response, 201, asset);
    return true;
  }

  if (pathname === "/api/assets/spritesheet" && request.method === "POST") {
    const asset = await assetService.uploadSpritesheetAsset(request);
    sendJson(response, 201, asset);
    return true;
  }

  const assetFileMatch = pathname.match(/^\/api\/assets\/([^/]+)\/file(?:\/.*)?$/);
  if (assetFileMatch && request.method === "GET") {
    const payload = await assetService.getAssetFile(decodeURIComponent(assetFileMatch[1]));
    if (!payload) {
      sendJson(response, 404, ERROR_ASSET_NOT_FOUND);
      return true;
    }
    sendCors(response);
    response.statusCode = 200;
    response.setHeader("Content-Type", payload.contentType);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.end(payload.body);
    return true;
  }

  const assetSheetMatch = pathname.match(/^\/api\/assets\/([^/]+)\/sheet(?:\/.*)?$/);
  if (assetSheetMatch && request.method === "GET") {
    const payload = await assetService.getAssetSheet(decodeURIComponent(assetSheetMatch[1]));
    if (!payload) {
      sendJson(response, 404, ERROR_SPRITESHEET_NOT_FOUND);
      return true;
    }
    sendCors(response);
    response.statusCode = 200;
    response.setHeader("Content-Type", payload.contentType);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.end(payload.body);
    return true;
  }

  return false;
}
