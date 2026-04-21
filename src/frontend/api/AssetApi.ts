import type { AssetSummary } from "../../shared/types";

export class AssetApi {
  async listAssets(): Promise<AssetSummary[]> {
    const response = await fetch("/api/assets");
    return this.parse<AssetSummary[]>(response);
  }

  async uploadImage(file: File): Promise<AssetSummary> {
    const response = await fetch("/api/assets/image", {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name)
      },
      body: file
    });
    return this.parse<AssetSummary>(response);
  }

  async uploadSpritesheet(image: File, json: File): Promise<AssetSummary> {
    const response = await fetch("/api/assets/spritesheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: image.name,
        imageFileName: image.name,
        imageContentType: image.type || "application/octet-stream",
        imageBase64: await this.readBase64(image),
        jsonFileName: json.name,
        jsonText: await json.text()
      })
    });
    return this.parse<AssetSummary>(response);
  }

  private async parse<T>(response: Response): Promise<T> {
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<T>;
  }

  private readBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result).split(",")[1] ?? ""));
      reader.addEventListener("error", () => reject(reader.error));
      reader.readAsDataURL(file);
    });
  }
}
