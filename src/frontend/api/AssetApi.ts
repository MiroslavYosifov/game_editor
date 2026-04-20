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

  private async parse<T>(response: Response): Promise<T> {
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<T>;
  }
}
