import type { AssetSummary } from "../../shared/types";
import { requestJson } from "./http";
import { readFileAsBase64 } from "../utils/file";

export class AssetApi {
  async listAssets(): Promise<AssetSummary[]> {
    return requestJson<AssetSummary[]>("/api/assets");
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
}
