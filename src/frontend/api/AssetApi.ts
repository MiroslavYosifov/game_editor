import type { AssetSummary, TileFrame } from "../../shared/types";
import { requestJson } from "./http";
import { readFileAsBase64 } from "../utils/file";

export class AssetApi {
  async listAssets(): Promise<AssetSummary[]> {
    return requestJson<AssetSummary[]>("/api/assets");
  }

  async deleteAsset(id: string): Promise<void> {
    return requestJson<void>(`/api/assets/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  }

  async uploadImage(file: File): Promise<AssetSummary> {
    return requestJson<AssetSummary>("/api/assets/image", {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name)
      },
      body: file
    });
  }

  async uploadSpritesheet(image: File, json: File): Promise<AssetSummary> {
    return requestJson<AssetSummary>("/api/assets/spritesheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: image.name,
        imageFileName: image.name,
        imageContentType: image.type || "application/octet-stream",
        imageBase64: await readFileAsBase64(image),
        jsonFileName: json.name,
        jsonText: await json.text()
      })
    });
  }

  async loadTileFrames(sheetUrl: string): Promise<TileFrame[]> {
    const sheet = await requestJson<{ frames?: Record<string, { frame: { x: number; y: number; w: number; h: number } }> | Array<{ filename: string; frame: { x: number; y: number; w: number; h: number } }> }>(sheetUrl);
    const entries = Array.isArray(sheet.frames)
      ? sheet.frames.map((frame) => [frame.filename, frame] as const)
      : Object.entries(sheet.frames ?? {});

    return entries
      .filter(([, frame]) => Boolean(frame?.frame))
      .map(([name, frame]) => ({
        name,
        x: frame.frame.x,
        y: frame.frame.y,
        w: frame.frame.w,
        h: frame.frame.h
      }));
  }
}
