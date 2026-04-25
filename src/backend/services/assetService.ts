import type { IncomingMessage } from "node:http";
import type { AssetSummary } from "../../shared/types";
import { badGateway, badRequest, serviceUnavailable } from "../infra/errors";
import { readBuffer, readJson } from "../infra/http";
import type { SupabaseClient } from "../infra/supabaseClient";

interface AssetRow {
  id: string;
  name: string;
  type: "image" | "spritesheet";
  storage_path: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface SpritesheetUploadPayload {
  name: string;
  imageFileName: string;
  imageContentType: string;
  imageBase64: string;
  jsonFileName: string;
  jsonText: string;
}

export interface AssetFilePayload {
  contentType: string;
  body: Buffer;
}

export class AssetService {
  constructor(private readonly supabaseClient: SupabaseClient | null) {}

  async listAssets(): Promise<AssetSummary[]> {
    const client = this.requireSupabase();
    const rows = await client.request<AssetRow[]>("/rest/v1/assets?select=id,name,type,storage_path,metadata,created_at&order=created_at.desc");
    return rows.map(toAssetSummary);
  }

  async uploadImageAsset(request: IncomingMessage): Promise<AssetSummary> {
    const client = this.requireSupabase();
    const contentType = (request.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
    if (!allowedTypes.has(contentType)) throw badRequest("Only PNG, JPG, and WebP images can be uploaded.");

    const file = await readBuffer(request);
    if (!file.length) throw badRequest("Upload file is empty.");

    const rawName = decodeURIComponent(String(request.headers["x-file-name"] ?? "sprite"));
    const safeName = sanitizeFileName(rawName);
    const storagePath = `images/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;

    await client.uploadStorageObject(storagePath, contentType, file);

    const rows = await client.request<AssetRow[]>("/rest/v1/assets", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        name: safeName,
        type: "image",
        storage_path: storagePath,
        metadata: {
          contentType,
          size: file.length
        }
      })
    });

    const row = rows[0];
    if (!row) throw badGateway("Asset uploaded, but asset metadata was not returned.");
    return toAssetSummary(row);
  }

  async uploadSpritesheetAsset(request: IncomingMessage): Promise<AssetSummary> {
    const client = this.requireSupabase();
    const payload = await readJson<SpritesheetUploadPayload>(request);
    const imageContentType = payload.imageContentType.trim().toLowerCase();
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
    if (!allowedTypes.has(imageContentType)) throw badRequest("Spritesheet image must be PNG, JPG, or WebP.");

    const sheetData = parseSpritesheetJson(payload.jsonText);
    const imageFileName = sanitizeFileName(payload.imageFileName);
    const jsonFileName = sanitizeFileName(payload.jsonFileName || "spritesheet.json");
    const folder = `spritesheets/${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const imagePath = `${folder}/${imageFileName}`;
    const jsonPath = `${folder}/${jsonFileName}`;
    const imageBuffer = Buffer.from(payload.imageBase64, "base64");

    if (!imageBuffer.length) throw badRequest("Spritesheet image file is empty.");

    await client.uploadStorageObject(imagePath, imageContentType, imageBuffer);
    await client.uploadStorageObject(jsonPath, "application/json", Buffer.from(JSON.stringify(sheetData.json), "utf8"));

    const rows = await client.request<AssetRow[]>("/rest/v1/assets", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        name: sanitizeFileName(payload.name || imageFileName),
        type: "spritesheet",
        storage_path: imagePath,
        metadata: {
          contentType: imageContentType,
          size: imageBuffer.length,
          sheetStoragePath: jsonPath,
          sheetFileName: jsonFileName,
          frameNames: sheetData.frameNames
        }
      })
    });

    const row = rows[0];
    if (!row) throw badGateway("Spritesheet uploaded, but asset metadata was not returned.");
    return toAssetSummary(row);
  }

  async getAssetFile(id: string): Promise<AssetFilePayload | null> {
    const client = this.requireSupabase();
    const row = await this.loadAssetById(id);
    if (!row) return null;

    const signedUrl = await client.createSignedAssetUrl(row.storage_path);
    const assetResponse = await fetch(signedUrl);
    if (!assetResponse.ok) {
      const body = await assetResponse.text();
      throw badGateway(`Asset file request failed: ${assetResponse.status} ${body}`);
    }

    return {
      contentType: String(row.metadata?.contentType ?? assetResponse.headers.get("content-type") ?? "application/octet-stream"),
      body: Buffer.from(await assetResponse.arrayBuffer())
    };
  }

  async getAssetSheet(id: string): Promise<AssetFilePayload | null> {
    const client = this.requireSupabase();
    const row = await this.loadAssetById(id);
    if (!row || row.type !== "spritesheet") return null;

    const sheetStoragePath = typeof row.metadata?.sheetStoragePath === "string" ? row.metadata.sheetStoragePath : "";
    if (!sheetStoragePath) return null;

    const signedUrl = await client.createSignedAssetUrl(sheetStoragePath);
    const sheetResponse = await fetch(signedUrl);
    if (!sheetResponse.ok) {
      const body = await sheetResponse.text();
      throw badGateway(`Spritesheet JSON request failed: ${sheetResponse.status} ${body}`);
    }

    return {
      contentType: "application/json; charset=utf-8",
      body: Buffer.from(await sheetResponse.text(), "utf8")
    };
  }

  async deleteAsset(id: string): Promise<boolean> {
    const client = this.requireSupabase();
    const row = await this.loadAssetById(id);
    if (!row) return false;

    await client.deleteStorageObject(row.storage_path);

    const sheetStoragePath = typeof row.metadata?.sheetStoragePath === "string" ? row.metadata.sheetStoragePath : "";
    if (row.type === "spritesheet" && sheetStoragePath) {
      await client.deleteStorageObject(sheetStoragePath);
    }

    await client.request<unknown>(`/rest/v1/assets?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });

    return true;
  }

  private async loadAssetById(id: string): Promise<AssetRow | null> {
    const client = this.requireSupabase();
    const rows = await client.request<AssetRow[]>(
      `/rest/v1/assets?id=eq.${encodeURIComponent(id)}&select=id,name,type,storage_path,metadata,created_at&limit=1`
    );
    return rows[0] ?? null;
  }

  private requireSupabase(): SupabaseClient {
    if (!this.supabaseClient) throw serviceUnavailable("Asset upload requires Supabase environment variables.");
    return this.supabaseClient;
  }
}

function parseSpritesheetJson(raw: string): { json: unknown; frameNames: string[] } {
  let parsed: { frames?: unknown };
  try {
    parsed = JSON.parse(raw) as { frames?: unknown };
  } catch {
    throw badRequest("Spritesheet JSON is not valid JSON.");
  }
  if (!parsed.frames || typeof parsed.frames !== "object") throw badRequest("Spritesheet JSON must include a frames object.");

  const frameNames = Array.isArray(parsed.frames)
    ? parsed.frames
        .map((frame) => (frame && typeof frame === "object" && "filename" in frame ? String((frame as { filename: unknown }).filename) : ""))
        .filter(Boolean)
    : Object.keys(parsed.frames);

  if (!frameNames.length) throw badRequest("Spritesheet JSON does not contain any frames.");
  return { json: parsed, frameNames };
}

function toAssetSummary(row: AssetRow): AssetSummary {
  const sheetFileName = typeof row.metadata?.sheetFileName === "string" ? row.metadata.sheetFileName : "spritesheet.json";
  const frameNames = Array.isArray(row.metadata?.frameNames) ? row.metadata.frameNames.filter((item): item is string => typeof item === "string") : undefined;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    storagePath: row.storage_path,
    url: `/api/assets/${encodeURIComponent(row.id)}/file/${encodeURIComponent(row.name)}`,
    sheetUrl: row.type === "spritesheet" ? `/api/assets/${encodeURIComponent(row.id)}/sheet/${encodeURIComponent(sheetFileName)}` : undefined,
    frameNames,
    createdAt: row.created_at
  };
}

function sanitizeFileName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
  return cleaned || "sprite.png";
}
