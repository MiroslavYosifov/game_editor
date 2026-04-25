import { Assets, Rectangle, Texture } from "pixi.js";
import type { TileMap } from "../../shared/types";

export class TilesetTextureCache {
  private readonly cache = new Map<string, Map<string, Texture>>();
  private readonly loads = new Map<string, Promise<void>>();

  get(tileMap: TileMap, onLoaded: () => void): Map<string, Texture> | null {
    const key = this.createKey(tileMap);
    const cached = this.cache.get(key);
    if (cached) return cached;

    if (!this.loads.has(key) && tileMap.imageUrl && tileMap.frames.length > 0) {
      const load = this.load(key, tileMap, onLoaded)
        .catch((error) => console.warn("[GameEditor] Failed to load tileset textures", error))
        .finally(() => this.loads.delete(key));
      this.loads.set(key, load);
    }

    return null;
  }

  private createKey(tileMap: TileMap): string {
    return `${tileMap.tilesetAssetId}|${tileMap.imageUrl}|${tileMap.frames.length}`;
  }

  private async load(key: string, tileMap: TileMap, onLoaded: () => void): Promise<void> {
    const baseTexture = (await Assets.load(tileMap.imageUrl)) as Texture;
    const textures = new Map<string, Texture>();

    for (const frame of tileMap.frames) {
      textures.set(frame.name, new Texture(baseTexture.baseTexture, new Rectangle(frame.x, frame.y, frame.w, frame.h)));
    }

    this.cache.set(key, textures);
    onLoaded();
  }
}
