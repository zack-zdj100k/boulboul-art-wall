import { beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { customOrderSchema } from "@/shared/lib/validation";
import { signUploadToken } from "@/backend/auth/tokens";
import { prisma } from "@/backend/db";
import { memoryProvider } from "@/backend/email/providers";
import { createCustomOrder } from "@/backend/services/custom-order";
import { uploadImage } from "@/backend/services/media";
import { listProductReviews, moderateReview, submitReview } from "@/backend/services/review";
import { createProductFixture, createUser, resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
  memoryProvider.reset();
});

const contact = { customerName: "Sara Test", email: "sara@test.dz", phone: "0771234567" };
// Same path as the API: raw input → shared schema → service.
const request = (input: Record<string, unknown>) => customOrderSchema.parse({ ...contact, ...input });

async function pngFile() {
  const buf = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#d9a65c" } }).png().toBuffer();
  return new File([new Uint8Array(buf)], "mon design.png", { type: "image/png" });
}

describe("Custom design requests", () => {
  it("stores the private upload, dimensions, frame, extras and description — without sending any email", async () => {
    const frame = await prisma.frameOption.create({ data: { name: "Noir" } });
    const extra = await prisma.extraOption.create({ data: { name: "Miroir" } });
    const media = await uploadImage({ file: await pngFile(), visibility: "PRIVATE", userId: null });
    expect(media.visibility).toBe("PRIVATE");
    expect(media.key.startsWith("private/")).toBe(true);
    expect(media.width).toBe(40);

    const order = await createCustomOrder(request({ designMediaId: media.id, designToken: signUploadToken(media.id), description: "Je veux ce design en 80x120 cm avec un cadre noir.", widthCm: 80, heightCm: 120, frameId: frame.id, extraIds: [extra.id] }),
      null,
    );
    expect(order.reference).toMatch(/^BAW-C-\d{4}-000001$/);
    expect(order).toMatchObject({ status: "PENDING", widthCm: 80, heightCm: 120, frameName: "Noir", designMediaId: media.id });
    expect(order.extras).toEqual([{ id: extra.id, name: "Miroir", price: extra.price }]);
    expect(order.estimatedPrice).toBeNull(); // Sur Mesure settings not configured → no estimate
    expect(memoryProvider.outbox).toHaveLength(0);
  });

  it("stores an estimate from the Sur Mesure settings (stable price ± per 10 cm + options)", async () => {
    const { updateSettings } = await import("@/backend/services/settings");
    await updateSettings({ "custom.refWidthCm": 60, "custom.refHeightCm": 80, "custom.refPrice": 5_000, "custom.widthStepPrice": 200, "custom.heightStepPrice": 200 });
    const frame = await prisma.frameOption.create({ data: { name: "Noir", price: 1_000 } });
    const order = await createCustomOrder(request({ description: "Un portrait", widthCm: 70, heightCm: 90, frameId: frame.id }), null);
    expect(order.estimatedPrice).toBe(5_400 + 1_000);
  });

  it("accepts a request with only a description (everything else optional)", async () => {
    const order = await createCustomOrder(request({ description: "Une idée de miroir pour mon salon." }), null);
    expect(order.designMediaId).toBeNull();
  });

  it("refuses another visitor's upload (missing/invalid token) and reuse of the same design", async () => {
    const media = await uploadImage({ file: await pngFile(), visibility: "PRIVATE", userId: null });
    await expect(createCustomOrder(request({ designMediaId: media.id, designToken: "forged" }), null)).rejects.toMatchObject({ code: "validation.invalid" });
    await createCustomOrder(request({ designMediaId: media.id, designToken: signUploadToken(media.id) }), null);
    await expect(createCustomOrder(request({ designMediaId: media.id, designToken: signUploadToken(media.id) }), null)).rejects.toMatchObject({ code: "validation.invalid" });
  });

  it("rejects dimensions outside the configured limits", async () => {
    await expect(createCustomOrder(request({ description: "x".repeat(20), widthCm: 900 }), null)).rejects.toMatchObject({ code: "errors.invalidSize" });
  });
});

describe("Reviews", () => {
  it("are hidden until approved, and one review per customer per product", async () => {
    const { product } = await createProductFixture();
    const user = await createUser("CUSTOMER");
    const admin = await createUser("ADMIN");
    const r = await submitReview({ productId: product.id, rating: 5, comment: "Très belle qualité, merci !" }, user);
    expect(r.status).toBe("PENDING");
    expect(await listProductReviews(product.id)).toHaveLength(0);
    await moderateReview(r.id, { status: "APPROVED" }, admin.id);
    expect(await listProductReviews(product.id)).toHaveLength(1);
    await expect(submitReview({ productId: product.id, rating: 4, comment: "Deuxième avis pour tester." }, user)).rejects.toMatchObject({ code: "reviews.already" });
    await moderateReview(r.id, { status: "HIDDEN" }, admin.id);
    expect(await listProductReviews(product.id)).toHaveLength(0);
  });
});

describe("Custom request quote", () => {
  it("computes price − discount + delivery on the server, never below zero", async () => {
    const { computeCustomQuote } = await import("@/shared/lib/quote");
    expect(computeCustomQuote({ price: null })).toEqual({ discount: 0, total: null });
    expect(computeCustomQuote({ price: 20_000, discountType: "PERCENT", discountValue: 10, deliveryFee: 800 })).toEqual({ discount: 2_000, total: 18_800 });
    expect(computeCustomQuote({ price: 5_000, discountType: "FIXED", discountValue: 9_000 })).toEqual({ discount: 5_000, total: 0 });
  });

  it("stores the admin quote and ignores any client total", async () => {
    const { updateCustomOrder } = await import("@/backend/services/custom-order");
    const admin = await createUser("ADMIN");
    const order = await createCustomOrder(request({ description: "Un miroir arche pour l'entrée." }), null);
    const updated = await updateCustomOrder(order.id, { price: 15_000, discountType: "FIXED", discountValue: 1_000, deliveryFee: 500, total: 1 } as never, admin.id);
    expect(updated.total).toBe(14_500);
    const statusOnly = await updateCustomOrder(order.id, { status: "APPROVED" }, admin.id);
    expect(statusOnly.total).toBe(14_500); // quote kept when only the status changes
  });

  it("appears in the unified Commandes list next to catalogue orders", async () => {
    const { searchAllOrders } = await import("@/backend/services/admin-queries");
    await createCustomOrder(request({ description: "Une idée de canvas." }), null);
    const all = await searchAllOrders({});
    expect(all.rows.map((r) => r.kind)).toContain("CUSTOM");
    expect((await searchAllOrders({ type: "ORDER" })).rows.every((r) => r.kind === "ORDER")).toBe(true);
  });
});

describe("Media deletion", () => {
  it("refuses in-use images unless forced, then detaches them", async () => {
    const { deleteMedia } = await import("@/backend/services/media");
    const admin = await createUser("ADMIN");
    const media = await uploadImage({ file: await pngFile(), visibility: "PUBLIC", userId: admin.id });
    const product = await prisma.product.create({
      data: { slug: "p-media", name: "P", images: { create: [{ mediaId: media.id }] } },
    });
    await expect(deleteMedia(media.id, admin.id)).rejects.toMatchObject({ code: "media.inUse" });
    await deleteMedia(media.id, admin.id, true);
    expect(await prisma.media.count({ where: { id: media.id } })).toBe(0);
    expect(await prisma.productImage.count({ where: { productId: product.id } })).toBe(0);
  });
});
