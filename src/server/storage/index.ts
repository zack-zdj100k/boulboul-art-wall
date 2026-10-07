import "server-only";
import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/server/env";

// Storage abstraction: local disk in development, any S3-compatible object storage in production.
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

// Keys are generated server-side ("public/2026/10/<random>.webp"); this guard is defence in depth.
export function assertSafeKey(key: string) {
  if (!/^(public|private)\/[a-z0-9/_.-]+$/i.test(key) || key.includes("..")) throw new Error("Invalid storage key");
}

class LocalDriver implements StorageDriver {
  private root = path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.STORAGE_LOCAL_DIR);
  private resolve(key: string) {
    assertSafeKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }
  async put(key: string, body: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
  }
  async get(key: string) {
    try {
      return await readFile(this.resolve(key));
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
}

/** Minimal AWS Signature V4 client (path-style) — works with S3, R2, Scaleway, MinIO… */
class S3Driver implements StorageDriver {
  private endpoint = env.S3_ENDPOINT.replace(/\/$/, "");
  private region = env.S3_REGION || "auto";

  private async request(method: "PUT" | "GET" | "DELETE", key: string, body?: Buffer, contentType?: string) {
    assertSafeKey(key);
    const url = new URL(`${this.endpoint}/${env.S3_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = amzDate.slice(0, 8);
    const payloadHash = createHash("sha256").update(body ?? "").digest("hex");
    const headers: Record<string, string> = {
      host: url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      ...(contentType ? { "content-type": contentType } : {}),
    };
    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonical = [
      method,
      url.pathname,
      "",
      Object.keys(headers).sort().map((h) => `${h}:${headers[h]}\n`).join(""),
      signedHeaders,
      payloadHash,
    ].join("\n");
    const scope = `${date}/${this.region}/s3/aws4_request`;
    const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
    const hmac = (k: Buffer | string, v: string) => createHmac("sha256", k).update(v).digest();
    const kSigning = hmac(hmac(hmac(hmac(`AWS4${env.S3_SECRET_ACCESS_KEY}`, date), this.region), "s3"), "aws4_request");
    const signature = createHmac("sha256", kSigning).update(toSign).digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${env.S3_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const { host: _host, ...sendHeaders } = headers;
    return fetch(url, {
      method,
      headers: { ...sendHeaders, authorization },
      body: body ? new Uint8Array(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
  }

  async put(key: string, body: Buffer, contentType: string) {
    const res = await this.request("PUT", key, body, contentType);
    if (!res.ok) throw new Error(`S3 PUT failed: ${res.status}`);
  }
  async get(key: string) {
    const res = await this.request("GET", key);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`S3 GET failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  async delete(key: string) {
    const res = await this.request("DELETE", key);
    if (!res.ok && res.status !== 404) throw new Error(`S3 DELETE failed: ${res.status}`);
  }
}

/**
 * Cloudinary (REST API, no SDK). Public keys are normal "upload" assets; private keys (customer
 * designs) are "authenticated" assets, readable only through signed URLs — the site always serves
 * them via the authorised /media route. Config: CLOUDINARY_URL=cloudinary://key:secret@cloud
 * (or CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET).
 */
export class CloudinaryDriver implements StorageDriver {
  private cloud: string;
  private key: string;
  private secret: string;
  constructor() {
    const fromUrl = env.CLOUDINARY_URL.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    this.key = fromUrl?.[1] ?? env.CLOUDINARY_API_KEY;
    this.secret = fromUrl?.[2] ?? env.CLOUDINARY_API_SECRET;
    this.cloud = fromUrl?.[3] ?? env.CLOUDINARY_CLOUD_NAME;
    if (!this.cloud || !this.key || !this.secret) throw new Error("Cloudinary is not configured (CLOUDINARY_URL)");
  }

  /** "public/2026/10/abc.webp" → "boulboul/public/2026/10/abc" (the extension is not part of the id). */
  publicId(key: string) {
    assertSafeKey(key);
    return `${env.CLOUDINARY_FOLDER.replace(/\/$/, "")}/${key.replace(/\.[a-z0-9]+$/i, "")}`;
  }
  private type(key: string) {
    return key.startsWith("private/") ? "authenticated" : "upload";
  }
  /** API signature: SHA-1 of the sorted params + secret. */
  sign(params: Record<string, string | number>) {
    const toSign = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    return createHash("sha1").update(toSign + this.secret).digest("hex");
  }
  /** Delivery URL; authenticated assets get a signed path component (s--xxxxxxxx--). */
  deliveryUrl(key: string) {
    const id = this.publicId(key);
    const type = this.type(key);
    if (type === "upload") return `https://res.cloudinary.com/${this.cloud}/image/upload/${id}`;
    const sig = createHash("sha1").update(id + this.secret).digest("base64").replace(/\//g, "_").replace(/\+/g, "-").slice(0, 8);
    return `https://res.cloudinary.com/${this.cloud}/image/authenticated/s--${sig}--/${id}`;
  }

  async put(key: string, body: Buffer, contentType: string) {
    const params = { overwrite: "true", public_id: this.publicId(key), timestamp: Math.floor(Date.now() / 1000), type: this.type(key) };
    const form = new FormData();
    for (const [k, v] of Object.entries(params)) form.append(k, String(v));
    form.append("api_key", this.key);
    form.append("signature", this.sign(params));
    form.append("file", new Blob([new Uint8Array(body)], { type: contentType }));
    const res = await fetch(`https://api.cloudinary.com/v1_1/${this.cloud}/image/upload`, { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`Cloudinary upload failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  async get(key: string) {
    const res = await fetch(this.deliveryUrl(key), { signal: AbortSignal.timeout(30_000) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Cloudinary GET failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  async delete(key: string) {
    const params = { invalidate: "true", public_id: this.publicId(key), timestamp: Math.floor(Date.now() / 1000), type: this.type(key) };
    const form = new FormData();
    for (const [k, v] of Object.entries(params)) form.append(k, String(v));
    form.append("api_key", this.key);
    form.append("signature", this.sign(params));
    const res = await fetch(`https://api.cloudinary.com/v1_1/${this.cloud}/image/destroy`, { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Cloudinary delete failed: ${res.status}`);
  }
}

let driver: StorageDriver | null = null;
export function getStorage(): StorageDriver {
  driver ??= env.STORAGE_DRIVER === "s3" ? new S3Driver() : env.STORAGE_DRIVER === "cloudinary" ? new CloudinaryDriver() : new LocalDriver();
  return driver;
}

/** Public URL for a media key. Private keys are always served through the authorised /media route. */
export function mediaUrl(key: string) {
  if (key.startsWith("public/") && env.STORAGE_DRIVER === "s3" && env.S3_PUBLIC_URL) {
    return `${env.S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  }
  // Public images straight from Cloudinary's CDN (auto format & quality).
  if (key.startsWith("public/") && env.STORAGE_DRIVER === "cloudinary") {
    const cloud = env.CLOUDINARY_URL.match(/@(.+)$/)?.[1] ?? env.CLOUDINARY_CLOUD_NAME;
    const id = `${env.CLOUDINARY_FOLDER.replace(/\/$/, "")}/${key.replace(/\.[a-z0-9]+$/i, "")}`;
    if (cloud) return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto/${id}`;
  }
  return `/media/${key}`;
}
