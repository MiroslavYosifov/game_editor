import { Assets, Rectangle, Texture } from "pixi.js";
import type { SpriteProperties } from "../../shared/types";

export type LoadedSpriteAsset =
  | { kind: "texture"; texture: Texture }
  | { kind: "textures"; textures: Texture[] };

interface TexturePackerFrame {
  frame: { x: number; y: number; w: number; h: number };
}

interface TexturePackerSheet {
  frames: Record<string, TexturePackerFrame> | Array<TexturePackerFrame & { filename: string }>;
}

export class SpriteAssetCache {
  private readonly spriteAssets = new Map<string, LoadedSpriteAsset>();
  private readonly spriteAssetLoads = new Map<string, Promise<void>>();

  get(sprite: SpriteProperties, onLoaded: () => void): LoadedSpriteAsset | null {
    const key = this.createKey(sprite);
    const loaded = this.spriteAssets.get(key);
    if (loaded) return loaded;

    if (!this.spriteAssetLoads.has(key)) {
      const load = this.loadSpriteAsset(key, sprite, onLoaded)
        .catch((error) => console.warn("[GameEditor] Failed to load sprite asset", error))
        .finally(() => this.spriteAssetLoads.delete(key));
      this.spriteAssetLoads.set(key, load);
    }

    return null;
  }

  private createKey(sprite: SpriteProperties): string {
    return `${sprite.sheetUrl}|${sprite.imageUrl}|${sprite.animation}`;
  }

  private async loadSpriteAsset(key: string, sprite: SpriteProperties, onLoaded: () => void): Promise<void> {
    if (sprite.sheetUrl) {
      const [sheet, baseTexture] = await Promise.all([
        fetch(sprite.sheetUrl).then((response) => {
          if (!response.ok) throw new Error(`Spritesheet JSON failed: ${response.status}`);
          return response.json() as Promise<TexturePackerSheet>;
        }),
        sprite.imageUrl ? (Assets.load(sprite.imageUrl) as Promise<Texture>) : Promise.reject(new Error("Spritesheet image URL is missing."))
      ]);
      const textures = this.createSpritesheetTextures(sheet, baseTexture, sprite.animation);
      if (textures.length > 1) this.spriteAssets.set(key, { kind: "textures", textures });
      else if (textures[0]) this.spriteAssets.set(key, { kind: "texture", texture: textures[0] });
      onLoaded();
      return;
    }

    if (sprite.imageUrl) {
      const texture = (await Assets.load(sprite.imageUrl)) as Texture;
      this.spriteAssets.set(key, { kind: "texture", texture });
      onLoaded();
    }
  }

  private createSpritesheetTextures(sheet: TexturePackerSheet, baseTexture: Texture, animation: string): Texture[] {
    const entries = Array.isArray(sheet.frames)
      ? sheet.frames.map((frame) => [frame.filename, frame] as const)
      : Object.entries(sheet.frames ?? {});
    const filtered = animation ? entries.filter(([name]) => name.toLowerCase().includes(animation.toLowerCase())) : entries;
    const selected = filtered.length ? filtered : entries;

    return selected
      .filter(([, item]) => Boolean(item?.frame))
      .map(([, item]) => {
        const frame = item.frame;
        return new Texture(baseTexture.baseTexture, new Rectangle(frame.x, frame.y, frame.w, frame.h));
      });
  }
}
