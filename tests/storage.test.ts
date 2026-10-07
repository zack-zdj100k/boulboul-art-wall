import { afterEach, describe, expect, it, vi } from "vitest";

// The env module is read once at import: set Cloudinary credentials, then import fresh modules.
async function loadCloudinary() {
  vi.resetModules();
  vi.stubEnv("STORAGE_DRIVER", "cloudinary");
  vi.stubEnv("CLOUDINARY_URL", "cloudinary://123456:abcd@demo-cloud");
  return import("@/backend/storage");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Cloudinary storage driver", () => {
  it("signs API calls like Cloudinary's documented example (sorted params + secret, SHA-1)", async () => {
    const { CloudinaryDriver } = await loadCloudinary();
    const d = new CloudinaryDriver();
    expect(d.sign({ public_id: "sample_image", timestamp: 1315060510, eager: "w_400,h_300,c_pad|w_260,h_200,c_crop" })).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });

  it("keeps public images on the CDN and customer designs private (authenticated, signed URL)", async () => {
    const { CloudinaryDriver, mediaUrl } = await loadCloudinary();
    const d = new CloudinaryDriver();
    expect(d.publicId("public/2026/10/abc.webp")).toBe("boulboul/public/2026/10/abc");
    expect(mediaUrl("public/2026/10/abc.webp")).toBe("https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/boulboul/public/2026/10/abc");
    expect(mediaUrl("private/2026/10/design.png")).toBe("/media/private/2026/10/design.png"); // only through the authorised route
    expect(d.deliveryUrl("private/2026/10/design.png")).toMatch(/^https:\/\/res\.cloudinary\.com\/demo-cloud\/image\/authenticated\/s--[\w-]{8}--\/boulboul\/private\/2026\/10\/design$/);
    expect(() => d.publicId("../etc/passwd")).toThrow();
  });

  it("uploads with a signed form (type authenticated for private files)", async () => {
    const { CloudinaryDriver } = await loadCloudinary();
    const calls: { url: string; body: FormData }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      calls.push({ url: String(url), body: init?.body as FormData });
      return new Response("{}", { status: 200 });
    });
    await new CloudinaryDriver().put("private/2026/10/design.png", Buffer.from("x"), "image/png");
    const [call] = calls;
    expect(call.url).toBe("https://api.cloudinary.com/v1_1/demo-cloud/image/upload");
    expect(call.body.get("type")).toBe("authenticated");
    expect(call.body.get("public_id")).toBe("boulboul/private/2026/10/design");
    expect(call.body.get("api_key")).toBe("123456");
    expect(String(call.body.get("signature"))).toMatch(/^[0-9a-f]{40}$/);
    expect(call.body.get("api_secret")).toBeNull(); // the secret is never sent
  });
});
