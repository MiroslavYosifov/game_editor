import { Assets, Rectangle, Texture } from "pixi.js";
import type { TileCell } from "../../shared/types";

export class TilesetTextureCache {
  private readonly cache = new Map<string, Texture>();
  private readonly loads = new Map<string, Promise<void>>();

  get(tile: TileCell, onLoaded: () => void): Texture | null {
    const key = this.createKey(tile);
    const cached = this.cache.get(key);
    if (cached) return cached;

    if (!this.loads.has(key) && tile.imageUrl) {
      const load = this.load(key, tile, onLoaded)
        .catch((error) => console.warn("[GameEditor] Failed to load tileset textures", error))
        .finally(() => this.loads.delete(key));
      this.loads.set(key, load);
    }

    return null;
  }

  private createKey(tile: TileCell): string {
    return `${tile.assetId}|${tile.imageUrl}|${tile.frame.x}|${tile.frame.y}|${tile.frame.w}|${tile.frame.h}`;
  }

  private async load(key: string, tile: TileCell, onLoaded: () => void): Promise<void> {
    const baseTexture = (await Assets.load(tile.imageUrl)) as Texture;
    const texture = new Texture(baseTexture.baseTexture, new Rectangle(tile.frame.x, tile.frame.y, tile.frame.w, tile.frame.h));
    this.cache.set(key, texture);
    onLoaded();
  }
}
