import { beforeEach, describe, expect, it } from "vitest";
import { measureSchema, productAdminSchema, surMesureSchema } from "@/lib/admin-validation";
import { prisma } from "@/server/db";
import { getPublished, publishSection, saveDraft } from "@/server/services/cms";
import { createOrder } from "@/server/services/order";
import { getMeasurePrice, getProductPrice, getSurMesurePrice } from "@/server/services/pricing";
import { archiveProduct, createProduct, deleteProductPermanently, updateProduct } from "@/server/services/product-admin";
import { deleteMeasure, saveMeasures, updateMeasure, updateSurMesure } from "@/server/services/product-pricing";
import { getStats } from "./stats-helper";
import { createProductFixture, createUser, customer, resetDb } from "./helpers";

beforeEach(resetDb);

describe("CMS draft / publish", () => {
  it("keeps drafts private until published, and drops undeclared fields", async () => {
    const admin = await createUser("ADMIN");
    await saveDraft("contact", { phone: "0550 00 00 00", injected: "<script>" }, admin.id);
    expect((await getPublished(["contact"])).contact).toEqual({});
    await publishSection("contact", admin.id);
    const published = await prisma.cmsSection.findUniqueOrThrow({ where: { key: "contact" } });
    expect(published.published).toMatchObject({ phone: "0550 00 00 00" });
    expect(published.published).not.toHaveProperty("injected");
    expect(await prisma.auditLog.count({ where: { entityType: "CmsSection" } })).toBe(2);
  });
});

describe("Product administration", () => {
  const base = { name: "Miroir test", status: "ACTIVE" };

  it("creates products with a unique slug; updating the product never touches its price tables", async () => {
    const admin = await createUser("ADMIN");
    const a = await createProduct(productAdminSchema.parse(base), admin.id);
    const b = await createProduct(productAdminSchema.parse(base), admin.id);
    expect(a.slug).toBe("miroir-test");
    expect(b.slug).toBe("miroir-test-2");
    await saveMeasures(a.id, [{ widthCm: 60, heightCm: 150, price: 12_000, isActive: true }], admin.id);
    await updateProduct(a.id, productAdminSchema.parse({ ...base, name: "Miroir renommé" }), admin.id);
    expect(await prisma.productMeasure.count({ where: { productId: a.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entityType: "Product" } })).toBe(4);
  });

  it("deletes even ordered products while keeping the order snapshot intact", async () => {
    const admin = await createUser("ADMIN");
    const { product } = await createProductFixture();
    const { order } = await createOrder({ items: [{ productId: product.id, widthCm: 100, heightCm: 100, extraIds: [], quantity: 1 }], customer }, { userId: null, locale: "fr" });
    await archiveProduct(product.id, admin.id);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).status).toBe("ARCHIVED");
    await deleteProductPermanently(product.id, admin.id);
    expect(await prisma.product.count({ where: { id: product.id } })).toBe(0);
    const kept = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
    expect(kept.items[0]).toMatchObject({ productName: "Canvas test", productId: null, totalPrice: order.items[0].totalPrice });
    expect((await getStats()).totalOrders).toBe(1);
  });

  it("rejects invalid promotions", () => {
    expect(productAdminSchema.safeParse({ ...base, promoType: "PERCENT", promoValue: 150 }).success).toBe(false);
  });
});

describe("Product pricing", () => {
  it("measures: any dimensions, explicit positive prices, unique per product (upsert)", async () => {
    const admin = await createUser("ADMIN");
    const p = await createProduct(productAdminSchema.parse({ name: "Tableau", status: "ACTIVE" }), admin.id);
    expect(measureSchema.safeParse({ widthCm: 65, heightCm: 93, price: 5_000 }).success).toBe(true);
    expect(measureSchema.safeParse({ widthCm: 70, heightCm: 100, price: 0 }).success).toBe(false);
    expect(measureSchema.safeParse({ widthCm: 0, heightCm: 100, price: 10 }).success).toBe(false);
    await saveMeasures(p.id, [{ widthCm: 40, heightCm: 40, price: 2_000, isActive: true }, { widthCm: 65, heightCm: 93, price: 5_000, isActive: true, label: "Spécial" }], admin.id);
    await saveMeasures(p.id, [{ widthCm: 40, heightCm: 40, price: 2_100, isActive: true }], admin.id);
    const rows = await prisma.productMeasure.findMany({ where: { productId: p.id }, orderBy: { widthCm: "asc" } });
    expect(rows.map((r) => [r.widthCm, r.heightCm, r.price, r.label])).toEqual([[40, 40, 2_100, null], [65, 93, 5_000, "Spécial"]]);
    await expect(saveMeasures(p.id, [{ widthCm: 50, heightCm: 50, price: 1, isActive: true }, { widthCm: 50, heightCm: 50, price: 2, isActive: true }], admin.id)).rejects.toMatchObject({ code: "pricing.duplicateDimension" });
    await updateMeasure(p.id, rows[1].id, { isActive: false }, admin.id);
    expect(await getMeasurePrice(p.id, 65, 93)).toBeNull();
    await deleteMeasure(p.id, rows[1].id, admin.id);
    expect(await prisma.productMeasure.count({ where: { productId: p.id } })).toBe(1);
  });

  it("Sur Mesure parameters: required to enable; getProductPrice checks measures before the calculation", async () => {
    const admin = await createUser("ADMIN");
    const p = await createProduct(productAdminSchema.parse({ name: "Canvas", status: "ACTIVE" }), admin.id);
    expect(surMesureSchema.safeParse({ enabled: true, refWidthCm: 60, refHeightCm: 80 }).success).toBe(false);
    const input = surMesureSchema.parse({ enabled: true, refWidthCm: 60, refHeightCm: 80, refPrice: 5_000, widthStepPrice: 200, heightStepPrice: 200 });
    await updateSurMesure(p.id, input, admin.id);
    await saveMeasures(p.id, [{ widthCm: 70, heightCm: 90, price: 9_999, isActive: true }], admin.id);
    expect(await getProductPrice(p.id, 70, 90)).toMatchObject({ source: "PRESET", price: 9_999 });
    expect(await getProductPrice(p.id, 70, 100)).toMatchObject({ source: "SUR_MESURE", price: 5_600 });
    expect(await getSurMesurePrice(p.id, 50, 70)).toMatchObject({ price: 4_600 });
    await updateSurMesure(p.id, { ...input, enabled: false }, admin.id);
    expect(await getProductPrice(p.id, 70, 100)).toBeNull();
    // The product info form never touches the pricing.
    await updateProduct(p.id, productAdminSchema.parse({ name: "Canvas renommé", status: "ACTIVE" }), admin.id);
    expect(await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ refPrice: 5_000, widthStepPrice: 200 });
  });
});

describe("Order deletion", () => {
  it("deletes an order with its items and history but keeps an audit trace", async () => {
    const { deleteOrder } = await import("@/server/services/order");
    const admin = await createUser("ADMIN");
    const { product } = await createProductFixture();
    const { order } = await createOrder({ items: [{ productId: product.id, widthCm: 100, heightCm: 100, extraIds: [], quantity: 1 }], customer }, { userId: null, locale: "fr" });
    await deleteOrder(order.id, admin.id);
    expect(await prisma.order.count({ where: { id: order.id } })).toBe(0);
    expect(await prisma.orderItem.count({ where: { orderId: order.id } })).toBe(0);
    const trace = await prisma.auditLog.findFirstOrThrow({ where: { action: "order.delete", entityId: order.id } });
    expect(trace.metadata).toMatchObject({ orderNumber: order.orderNumber });
  });
});

describe("Customer accounts (admin)", () => {
  it("edits, promotes, protects the last admin and self, deletes while keeping orders", async () => {
    const { deleteUserByAdmin, updateUserByAdmin } = await import("@/server/services/user-admin");
    const admin = await createUser("ADMIN");
    const client = await createUser("CUSTOMER");
    await updateUserByAdmin(client.id, { fullName: "Nouveau Nom", phone: "0550123456" }, admin);
    await updateUserByAdmin(client.id, { role: "ADMIN" }, admin);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: client.id } })).role).toBe("ADMIN");
    await expect(updateUserByAdmin(admin.id, { role: "CUSTOMER" }, admin)).rejects.toMatchObject({ code: "users.self" });
    await expect(deleteUserByAdmin(admin.id, admin)).rejects.toMatchObject({ code: "users.self" });
    await updateUserByAdmin(client.id, { role: "CUSTOMER" }, admin);
    await expect(updateUserByAdmin(admin.id, { isActive: false }, { id: client.id })).rejects.toMatchObject({ code: "users.lastAdmin" });

    const { product } = await createProductFixture();
    const { order } = await createOrder({ items: [{ productId: product.id, widthCm: 50, heightCm: 50, extraIds: [], quantity: 1 }], customer }, { userId: client.id, locale: "fr" });
    await deleteUserByAdmin(client.id, admin);
    expect(await prisma.user.count({ where: { id: client.id } })).toBe(0);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ userId: null, customerName: "Amina Test" });
  });
});
