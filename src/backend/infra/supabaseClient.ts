import { badGateway } from "./errors";

export interface SupabaseConfig {
  url: string;
  key: string;
  storageBucket: string;
}

export function parseSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const storageBucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "assets";
  if (!url || !key) return null;
  return { url, key, storageBucket };
}

export class SupabaseClient {
  constructor(private readonly config: SupabaseConfig) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.config.url}${path}`, {
      ...init,
      headers: {
        apikey: this.config.key,
        "Content-Type": "application/json",
        ...this.getAuthHeader(),
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw badGateway(`Supabase request failed: ${response.status} ${body}`);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  async storageRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.config.url}${path}`, {
      ...init,
      headers: {
        apikey: this.config.key,
        ...this.getAuthHeader(),
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw badGateway(`Supabase storage request failed: ${response.status} ${body}`);
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async createSignedAssetUrl(storagePath: string): Promise<string> {
    const result = await this.storageRequest<{ signedURL?: string; signedUrl?: string }>(
      `/storage/v1/object/sign/${this.config.storageBucket}/${encodeStoragePath(storagePath)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: 300 })
      }
    );
    const signedPath = result.signedURL ?? result.signedUrl;
    if (!signedPath) throw badGateway("Supabase did not return a signed asset URL.");
    return signedPath.startsWith("http") ? signedPath : `${this.config.url}/storage/v1${signedPath}`;
  }

  async uploadStorageObject(storagePath: string, contentType: string, file: Buffer): Promise<void> {
    await this.storageRequest(`/storage/v1/object/${this.config.storageBucket}/${encodeStoragePath(storagePath)}`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "x-upsert": "false"
      },
      body: file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
    });
  }

  async deleteStorageObject(storagePath: string): Promise<void> {
    await this.storageRequest(`/storage/v1/object/${this.config.storageBucket}/${encodeStoragePath(storagePath)}`, {
      method: "DELETE"
    });
  }

  private getAuthHeader(): Record<string, string> {
    if (this.config.key.startsWith("sb_secret_") || this.config.key.startsWith("sb_publishable_")) return {};
    return { Authorization: `Bearer ${this.config.key}` };
  }
}

function encodeStoragePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
