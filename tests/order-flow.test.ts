import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { memoryProvider } from "@/server/email/providers";
import { changeOrderDimensions, createOrder, negotiateOrder, previewDimensionChange, revertOrderStatus, separateDelivery, setOrderDeliveryFee, updateOrderStatus } from "@/server/services/order";
import { createReturnRequest, deleteReturnRequest, returnableQuantities, updateReturnStatus } from "@/server/services/returns";
import { createProductFixture, createUser, customer, resetDb, surMesureFixture } from "./helpers";

beforeEach(async () => {
  await resetDb();
  memoryProvider.reset();
});

async function placeOrder(widthCm = 80, heightCm = 120) {
  const { product, frame, extra } = await createProductFixture();
  const { order, email } = await createOrder(
    { items: [{ productId: product.id, widthCm, heightCm, frameId: frame.id, extraIds: [extra.id], quantity: 1 }], customer },
    { userId: null, locale: "fr" },
  );
  return { order, email, product };
}

describe("Order creation", () => {
  it("creates a PENDING order priced from the table, with a full price snapshot and a BAW number", async () => {
    const { order } = await placeOrder();
    expect(order.status).toBe("PENDING");
    expect(order.orderNumber).toMatch(/^BAW-\d{4}-000001$/);
    expect(order.subtotal).toBe(12_000 + 1_000 + 2_500); // standard 80×120 + fixed frame + option
    expect(order.items[0]).toMatchObject({ pricingType: "PRESET", officialPrice: 12_000, promotionDiscount: 0, priceAfterPromotion: 12_000, optionsPrice: 3_500, unitPrice: 15_500 });
    expect(order.negotiatedDiscount).toBe(0);
    expect(order.deliveryFee).toBeNull(); // no delivery rule configured → to be confirmed
    expect(order.total).toBe(order.subtotal);
    const [item] = order.items;
    expect(item).toMatchObject({ productName: "Canvas test", widthCm: 80, heightCm: 120, frameName: "Cadre test", quantity: 1 });
    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ fromStatus: null, toStatus: "PENDING" });
  });

  it("generates sequential, unique order numbers", async () => {
    const { product } = await createProductFixture();
    const make = () => createOrder({ items: [{ productId: product.id, widthCm: 100, heightCm: 100, extraIds: [], quantity: 1 }], customer }, { userId: null, locale: "fr" });
    const results = await Promise.all([make(), make(), make()]);
    const numbers = results.map((r) => r.order.orderNumber);
    expect(new Set(numbers).size).toBe(3);
  });

  it("prices each created measure from its own row", async () => {
    const a = await placeOrder(50, 50);
    expect(a.order.items[0].officialPrice).toBe(3_000);
    const b = await placeOrder(65, 90);
    expect(b.order.items[0]).toMatchObject({ pricingType: "PRESET", pricingLabel: "Medium Custom", officialPrice: 5_200 });
  });

  it("prices any other measure with Sur Mesure (stable price ± 200 DA per 10 cm)", async () => {
    const { product } = await createProductFixture(surMesureFixture);
    const { order } = await createOrder({ items: [{ productId: product.id, widthCm: 70, heightCm: 90, extraIds: [], quantity: 1 }], customer }, { userId: null, locale: "fr" });
    expect(order.items[0]).toMatchObject({ pricingType: "SUR_MESURE", pricingRefId: null, officialPrice: 5_400 });
    expect(memoryProvider.outbox[0].html).toContain("Sur Mesure (calculé depuis le prix de référence)");
    // A created measure still wins over the calculation.
    const { order: preset } = await createOrder({ items: [{ productId: product.id, widthCm: 50, heightCm: 50, extraIds: [], quantity: 1 }], customer }, { userId: null, locale: "fr" });
    expect(preset.items[0]).toMatchObject({ pricingType: "PRESET", officialPrice: 3_000 });
  });

  it("refuses unconfigured dimensions when Sur Mesure is off", async () => {
    const { product } = await createProductFixture();
    await expect(
      createOrder({ items: [{ productId: product.id, widthCm: 67, heightCm: 93, extraIds: [], quantity: 1 }], customer }, { userId: null, locale: "fr" }),
    ).rejects.toMatchObject({ code: "pricing.needsSurMesure" });
  });

  it("applies the product promotion to the official price and snapshots it", async () => {
    const { product } = await createProductFixture({ promoType: "FIXED", promoValue: 500 });
    const { order } = await createOrder({ items: [{ productId: product.id, widthCm: 100, heightCm: 100, extraIds: [], quantity: 1 }], customer }, { userId: null, locale: "fr" });
    expect(order.items[0]).toMatchObject({ officialPrice: 10_000, promotionType: "FIXED", promotionValue: 500, promotionDiscount: 500, priceAfterPromotion: 9_500 });
    expect(order.total).toBe(9_500);
  });

  it("adds the configured delivery fee", async () => {
    await prisma.deliveryRule.create({ data: { wilayaCode: "16", fee: 600 } });
    const { order } = await placeOrder();
    expect(order.deliveryFee).toBe(600);
    expect(order.total).toBe(order.subtotal + 600);
  });

  it("ignores any client-side price and rejects invalid configurations", async () => {
    const { product, frame } = await createProductFixture();
    const forged = { productId: product.id, widthCm: 100, heightCm: 100, frameId: frame.id, extraIds: [], quantity: 1, unitPrice: 1, total: 1 };
    const { order } = await createOrder({ items: [forged], customer }, { userId: null, locale: "fr" });
    expect(order.subtotal).toBe(10_000 + 1_000); // table price + fixed frame
  });

  it("refuses invalid dimensions and archived products", async () => {
    const { product } = await createProductFixture();
    await expect(
      createOrder({ items: [{ productId: product.id, widthCm: 0, heightCm: 100, extraIds: [], quantity: 1 }], customer }, { userId: null, locale: "fr" }),
    ).rejects.toMatchObject({ code: "errors.invalidSize" });
    await prisma.product.update({ where: { id: product.id }, data: { status: "ARCHIVED" } });
    await expect(
      createOrder({ items: [{ productId: product.id, widthCm: 100, heightCm: 100, extraIds: [], quantity: 1 }], customer }, { userId: null, locale: "fr" }),
    ).rejects.toMatchObject({ code: "errors.productUnavailable" });
  });

  it("keeps old orders unchanged when the price table changes later", async () => {
    const { order, product } = await placeOrder();
    await prisma.productMeasure.updateMany({ where: { productId: product.id }, data: { price: 99_999 } });
    await prisma.product.update({ where: { id: product.id }, data: { name: "Renamed" } });
    const reloaded = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
    expect(reloaded.subtotal).toBe(order.subtotal);
    expect(reloaded.items[0]).toMatchObject({ productName: "Canvas test", officialPrice: 12_000 });
  });
});

describe("Email triggers (exactly two)", () => {
  it("creating a PENDING order sends the admin email with full order details", async () => {
    const { order, email } = await placeOrder();
    expect(email.ok).toBe(true);
    expect(memoryProvider.outbox).toHaveLength(1);
    const [msg] = memoryProvider.outbox;
    expect(msg.to).toBe("admin-test@boulboul.local");
    expect(msg.subject).toBe(`Nouvelle commande — ${order.orderNumber}`);
    for (const s of ["Amina Test", "amina@test.dz", "0551234567", "Alger", "Bab Ezzouar", "Cité test", "Canvas test", "80 × 120 cm", "Mesure proposée", "Prix officiel", "Promotion", "Négociation", "Cadre test", "LED test", "En attente", `/admin/orders/${order.id}`]) {
      expect(msg.html).toContain(s);
    }
    const logs = await prisma.emailLog.findMany({ where: { orderId: order.id } });
    expect(logs).toMatchObject([{ type: "NEW_ORDER_ADMIN", status: "SENT" }]);
  });

  it("PENDING → CONFIRMED sends the customer confirmation email", async () => {
    const admin = await createUser("ADMIN");
    const { order } = await placeOrder();
    memoryProvider.reset();
    const res = await updateOrderStatus(order.id, "CONFIRMED", admin);
    expect(res.order.status).toBe("CONFIRMED");
    expect(res.order.confirmedAt).toBeInstanceOf(Date);
    expect(memoryProvider.outbox).toHaveLength(1);
    const [msg] = memoryProvider.outbox;
    expect(msg.to).toBe("amina@test.dz");
    expect(msg.subject).toBe(`Votre commande ${order.orderNumber} est confirmée`);
    for (const s of ["Canvas test", "80 × 120 cm", "Cadre test", "LED test", "Cité test", "Confirmée"]) expect(msg.html).toContain(s);
    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    expect(history.at(-1)).toMatchObject({ fromStatus: "PENDING", toStatus: "CONFIRMED", changedById: admin.id });
    expect(await prisma.auditLog.count({ where: { action: "order.status", entityId: order.id } })).toBe(1);
  });

  it("PENDING → CONTACTING sends nothing; CONTACTING → CONFIRMED sends the confirmation with the negotiated price", async () => {
    const admin = await createUser("ADMIN");
    const { order } = await placeOrder();
    memoryProvider.reset();
    expect((await updateOrderStatus(order.id, "CONTACTING", admin)).email).toBeNull();
    await negotiateOrder(order.id, { type: "AMOUNT", value: 1_500 }, admin);
    expect(memoryProvider.outbox).toHaveLength(0);
    const res = await updateOrderStatus(order.id, "CONFIRMED", admin);
    expect(res.email?.ok).toBe(true);
    const [msg] = memoryProvider.outbox;
    expect(msg.html).toContain("Remise accordée");
    expect(msg.html).toContain("14"); // 15 500 − 1 500 = 14 000
    expect(res.order.total).toBe(14_000);
  });

  it("→ DELIVERED sends the delivery email to the customer once (KING 253 style), with a link to the order", async () => {
    const admin = await createUser("ADMIN");
    const { order } = await placeOrder();
    await updateOrderStatus(order.id, "CONFIRMED", admin);
    memoryProvider.reset();
    expect((await updateOrderStatus(order.id, "DELIVERED", admin)).email?.ok).toBe(true);
    const [msg] = memoryProvider.outbox;
    expect(msg.to).toBe("amina@test.dz");
    expect(msg.subject).toBe(`Votre commande ${order.orderNumber} a été livrée`);
    expect(msg.html).toContain(`/order/${order.orderNumber}?token=`);
    // Undo then deliver again → not sent twice.
    await revertOrderStatus(order.id, admin);
    memoryProvider.reset();
    expect((await updateOrderStatus(order.id, "DELIVERED", admin)).email).toBeNull();
    expect(memoryProvider.outbox).toHaveLength(0);
  });

  it("notification settings: several admin recipients, sender name, customer emails can be turned off", async () => {
    const { updateSettings } = await import("@/server/services/settings");
    await updateSettings({ "email.adminRecipients": "boss@test.dz, shop@test.dz", "email.fromName": "Boulboul Cadres", "email.customerConfirmed": false, "email.customerDelivered": false });
    const admin = await createUser("ADMIN");
    const { order } = await placeOrder();
    expect(memoryProvider.outbox.map((m) => m.to)).toEqual(["boss@test.dz", "shop@test.dz"]);
    expect(memoryProvider.outbox[0].from).toBe("Boulboul Cadres <no-reply@localhost>");
    memoryProvider.reset();
    expect((await updateOrderStatus(order.id, "CONFIRMED", admin)).email).toBeNull();
    expect((await updateOrderStatus(order.id, "DELIVERED", admin)).email).toBeNull();
    expect(memoryProvider.outbox).toHaveLength(0);
    await expect(updateSettings({ "email.adminRecipients": "pas-un-email" })).rejects.toBeDefined();
  });

  it("PENDING → CANCELLED sends no email", async () => {
    const admin = await createUser("ADMIN");
    const { order } = await placeOrder();
    memoryProvider.reset();
    const res = await updateOrderStatus(order.id, "CANCELLED", admin);
    expect(res.email).toBeNull();
    expect(memoryProvider.outbox).toHaveLength(0);
  });

  it("an email failure never deletes or rolls back the order, and is logged", async () => {
    memoryProvider.failNext = true;
    const { order, email } = await placeOrder();
    expect(email.ok).toBe(false);
    expect(await prisma.order.findUnique({ where: { id: order.id } })).not.toBeNull();
    const log = await prisma.emailLog.findFirstOrThrow({ where: { orderId: order.id } });
    expect(log).toMatchObject({ status: "FAILED", type: "NEW_ORDER_ADMIN" });
    expect(log.error).toContain("Simulated");

    const admin = await createUser("ADMIN");
    memoryProvider.failNext = true;
    const res = await updateOrderStatus(order.id, "CONFIRMED", admin);
    expect(res.email?.ok).toBe(false);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CONFIRMED");
  });

  it("rejects invalid transitions", async () => {
    const admin = await createUser("ADMIN");
    const { order } = await placeOrder();
    // Forward jumps are allowed (straight to delivered → delivery email); final states can't be left.
    expect((await updateOrderStatus(order.id, "DELIVERED", admin)).email?.ok).toBe(true);
    await expect(updateOrderStatus(order.id, "CANCELLED", admin)).rejects.toMatchObject({ code: "order.invalidTransition" });
    const { order: other } = await placeOrder();
    await updateOrderStatus(other.id, "CANCELLED", admin);
    await expect(updateOrderStatus(other.id, "CONFIRMED", admin)).rejects.toMatchObject({ code: "order.invalidTransition" });
  });
});

describe("Option colours and notes", () => {
  it("requires an offered colour, keeps notes only where asked, and snapshots both on the order", async () => {
    const { product, extra } = await createProductFixture();
    await prisma.extraOption.update({
      where: { id: extra.id },
      data: { colors: [{ name: "Blanc chaud", hex: "#ffd9a0" }], askNote: true, notePrompt: "Où ?" },
    });
    const item = { productId: product.id, widthCm: 100, heightCm: 100, extraIds: [extra.id], quantity: 1 };
    await expect(createOrder({ items: [item], customer }, { userId: null, locale: "fr" })).rejects.toMatchObject({ code: "errors.invalidOption" });
    await expect(
      createOrder({ items: [{ ...item, extraChoices: [{ id: extra.id, color: "Violet" }] }], customer }, { userId: null, locale: "fr" }),
    ).rejects.toMatchObject({ code: "errors.invalidOption" });
    const { order } = await createOrder(
      { items: [{ ...item, extraChoices: [{ id: extra.id, color: "Blanc chaud", note: "En haut à gauche" }] }], customer },
      { userId: null, locale: "fr" },
    );
    expect(order.items[0].extras).toEqual([{ id: extra.id, name: "LED test", price: 2_500, color: "Blanc chaud", note: "En haut à gauche" }]);
    expect(memoryProvider.outbox[0].html).toContain("Blanc chaud");
  });
});

describe("Manager price changes (per order)", () => {
  it("negotiation follows the spec example and is recorded without touching the price table", async () => {
    const admin = await createUser("ADMIN");
    const { product } = await createProductFixture({ promoType: "FIXED", promoValue: 500 });
    await prisma.productMeasure.create({ data: { productId: product.id, widthCm: 70, heightCm: 100, price: 5_500 } });
    await prisma.deliveryRule.create({ data: { wilayaCode: "16", fee: 800 } });
    const { order } = await createOrder({ items: [{ productId: product.id, widthCm: 70, heightCm: 100, extraIds: [], quantity: 1 }], customer }, { userId: null, locale: "fr" });
    expect(order.total).toBe(5_800); // 5 500 − 500 promo + 800 delivery

    const totals = await negotiateOrder(order.id, { type: "AMOUNT", value: 300, note: "Accord téléphone" }, admin);
    expect(totals).toMatchObject({ finalProductPrice: 4_700, total: 5_500 });
    const history = await prisma.orderPriceAdjustment.findMany({ where: { orderId: order.id } });
    expect(history).toMatchObject([{ kind: "NEGOTIATION", previousPrice: 5_000, newPrice: 4_700, discountAmount: 300, note: "Accord téléphone", actorId: admin.id }]);
    const official = await prisma.productMeasure.findFirstOrThrow({ where: { productId: product.id, widthCm: 70, heightCm: 100 } });
    expect(official.price).toBe(5_500);

    await negotiateOrder(order.id, { type: "PERCENT", value: 10 }, admin); // re-negotiated, history kept
    expect(await prisma.orderPriceAdjustment.count({ where: { orderId: order.id, kind: "NEGOTIATION" } })).toBe(2);
    await expect(negotiateOrder(order.id, { type: "AMOUNT", value: 9_999 }, admin)).rejects.toMatchObject({ code: "pricing.invalidDiscount" });
  });

  it("dimension change looks the price up again, saves a new snapshot and clears the negotiation", async () => {
    const admin = await createUser("ADMIN");
    const { order } = await placeOrder(80, 120);
    await negotiateOrder(order.id, { type: "AMOUNT", value: 1_000 }, admin);
    const item = order.items[0];

    const preview = await previewDimensionChange(order.id, item.id, 65, 90);
    expect(preview.quote).toMatchObject({ pricingType: "PRESET", officialPrice: 5_200, unitPrice: 5_200 + 3_500 });
    await expect(changeOrderDimensions(order.id, { itemId: item.id, widthCm: 67, heightCm: 93 }, admin)).rejects.toMatchObject({ code: "pricing.needsSurMesure" });

    const totals = await changeOrderDimensions(order.id, { itemId: item.id, widthCm: 65, heightCm: 90, note: "Client" }, admin);
    expect(totals.total).toBe(8_700);
    const reloaded = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, adjustments: true } });
    expect(reloaded).toMatchObject({ subtotal: 8_700, negotiatedDiscount: 0, total: 8_700 });
    expect(reloaded.items[0]).toMatchObject({ widthCm: 65, heightCm: 90, pricingType: "PRESET", officialPrice: 5_200, optionsPrice: 3_500 });
    expect(reloaded.adjustments.map((a) => a.kind)).toEqual(["NEGOTIATION", "DIMENSION_CHANGE"]);

    // Once Sur Mesure is enabled, any other measure gets the calculated price.
    await prisma.product.update({ where: { id: order.items[0].productId! }, data: surMesureFixture });
    const totals2 = await changeOrderDimensions(order.id, { itemId: item.id, widthCm: 91, heightCm: 60 }, admin);
    // 5 000 + 4 × 200 (91 cm = 4 started steps) − 2 × 200 = 5 400, + 3 500 options
    expect(totals2.total).toBe(5_400 + 3_500);
    const it2 = await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(it2).toMatchObject({ pricingType: "SUR_MESURE", officialPrice: 5_400 });
  });

  it("delivery fee can be set by a manager; closed orders can no longer be changed", async () => {
    const admin = await createUser("ADMIN");
    const { order } = await placeOrder();
    expect((await setOrderDeliveryFee(order.id, { deliveryFee: 700 }, admin)).total).toBe(order.subtotal + 700);
    await expect(setOrderDeliveryFee(order.id, { deliveryFee: -1 }, admin)).rejects.toMatchObject({ code: "pricing.invalidDeliveryFee" });
    await updateOrderStatus(order.id, "DELIVERED", admin);
    await expect(negotiateOrder(order.id, { type: "AMOUNT", value: 100 }, admin)).rejects.toMatchObject({ code: "order.closed" });
  });
});

describe("Returns & exchanges", () => {
  it("only on delivered orders, one open request at a time, never changes the price snapshot", async () => {
    const admin = await createUser("ADMIN");
    const { order } = await placeOrder();
    await expect(createReturnRequest(order.id, { type: "RETURN", reason: "Abîmé" }, { source: "CUSTOMER", actorId: null })).rejects.toMatchObject({ code: "returns.notDelivered" });
    await updateOrderStatus(order.id, "DELIVERED", admin);
    memoryProvider.reset();
    const req = await createReturnRequest(order.id, { type: "EXCHANGE", reason: "Autre couleur" }, { source: "CUSTOMER", actorId: null });
    await expect(createReturnRequest(order.id, { type: "RETURN", reason: "Encore" }, { source: "CUSTOMER", actorId: null })).rejects.toMatchObject({ code: "returns.alreadyOpen" });

    await updateReturnStatus(req.id, { status: "APPROVED" }, admin);
    await updateReturnStatus(req.id, { status: "EXCHANGE_PROCESSING" }, admin);
    await expect(updateReturnStatus(req.id, { status: "REQUESTED" }, admin)).rejects.toMatchObject({ code: "returns.invalidTransition" });
    await updateReturnStatus(req.id, { status: "COMPLETED", note: "Échangé" }, admin);

    const reloaded = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(reloaded.total).toBe(order.total);
    expect(await prisma.returnStatusHistory.count({ where: { requestId: req.id } })).toBe(4);
    expect(memoryProvider.outbox).toHaveLength(0); // return requests send no email
  });

  it("admin exchange (KING 253 flow): replacement measure priced by the engine, approve now, per-item quantities, delete", async () => {
    const admin = await createUser("ADMIN");
    const { product } = await createProductFixture(surMesureFixture);
    const { order } = await createOrder({ items: [{ productId: product.id, widthCm: 80, heightCm: 120, extraIds: [], quantity: 2 }], customer }, { userId: null, locale: "fr" });
    await updateOrderStatus(order.id, "DELIVERED", admin);
    const item = order.items[0];
    await expect(createReturnRequest(order.id, { type: "EXCHANGE", reason: "Mauvaise dimension", orderItemId: item.id }, { source: "ADMIN", actorId: admin.id })).rejects.toMatchObject({ code: "returns.replacementRequired" });

    const req = await createReturnRequest(order.id, { type: "EXCHANGE", reason: "Mauvaise dimension", orderItemId: item.id, quantity: 1, replacement: { widthCm: 70, heightCm: 90 }, approve: true }, { source: "ADMIN", actorId: admin.id });
    expect(req).toMatchObject({ status: "APPROVED", quantity: 1, replacementWidthCm: 70, replacementHeightCm: 90, replacementPricingType: "SUR_MESURE", replacementPrice: 5_400 });
    expect((await returnableQuantities(order.id)).get(item.id)).toBe(1);

    const preset = await createReturnRequest(order.id, { type: "EXCHANGE", reason: "Autre", orderItemId: item.id, quantity: 1, replacement: { widthCm: 50, heightCm: 50 } }, { source: "ADMIN", actorId: admin.id });
    expect(preset).toMatchObject({ status: "REQUESTED", replacementPricingType: "PRESET", replacementPrice: 3_000 });
    await expect(createReturnRequest(order.id, { type: "RETURN", reason: "Autre", orderItemId: item.id }, { source: "ADMIN", actorId: admin.id })).rejects.toMatchObject({ code: "returns.alreadyOpen" });

    await updateReturnStatus(preset.id, { status: "REJECTED" }, admin); // a rejected request frees its unit
    expect((await returnableQuantities(order.id)).get(item.id)).toBe(1);
    await deleteReturnRequest(req.id, admin.id);
    expect((await returnableQuantities(order.id)).get(item.id)).toBe(2);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).total).toBe(order.total);
  });

  it("a return cannot go through « exchange processing »", async () => {
    const admin = await createUser("ADMIN");
    const { order } = await placeOrder();
    await updateOrderStatus(order.id, "DELIVERED", admin);
    const req = await createReturnRequest(order.id, { type: "RETURN", reason: "Abîmé" }, { source: "ADMIN", actorId: admin.id });
    await updateReturnStatus(req.id, { status: "APPROVED" }, admin);
    await expect(updateReturnStatus(req.id, { status: "EXCHANGE_PROCESSING" }, admin)).rejects.toMatchObject({ code: "returns.invalidTransition" });
  });
});

describe("Several pieces, grouped deliveries, delivery methods", () => {
  const rule = { wilayaCode: "16", fee: 500, stopDeskFee: 430, returnFee: 200 };

  it("one order can hold several products and several Sur Mesure pieces", async () => {
    const { product } = await createProductFixture(surMesureFixture);
    const { product: other } = await createProductFixture();
    const { order } = await createOrder(
      {
        items: [
          { productId: product.id, widthCm: 70, heightCm: 90, extraIds: [], quantity: 2 },
          { productId: product.id, widthCm: 80, heightCm: 100, extraIds: [], quantity: 1 },
          { productId: other.id, widthCm: 50, heightCm: 50, extraIds: [], quantity: 1 },
        ],
        customer,
      },
      { userId: null, locale: "fr" },
    );
    expect(order.items).toHaveLength(3);
    expect(order.subtotal).toBe(5_400 * 2 + 5_800 + 3_000); // 80 × 100: +2 steps on each side
  });

  it("the commune must be one of the chosen wilaya's communes (official name is stored)", async () => {
    const { product } = await createProductFixture();
    const item = { productId: product.id, widthCm: 50, heightCm: 50, extraIds: [], quantity: 1 };
    await expect(createOrder({ items: [item], customer: { ...customer, commune: "Oran" } }, { userId: null, locale: "fr" })).rejects.toMatchObject({ code: "validation.commune" });
    const { order } = await createOrder({ items: [item], customer: { ...customer, commune: "bab-ezzouar" } }, { userId: null, locale: "fr" });
    expect(order.commune).toBe("Bab Ezzouar");
    // A commune of a 2026 wilaya is listed under the wilaya it was created from (Barika → Batna).
    const { order: batna } = await createOrder({ items: [item], customer: { ...customer, wilayaCode: "05", commune: "Barika" } }, { userId: null, locale: "fr" });
    expect(batna.commune).toBe("Barika");
  });

  it("stop desk uses its own price; refused where it is not offered", async () => {
    await prisma.deliveryRule.create({ data: rule });
    const { product } = await createProductFixture();
    const item = { productId: product.id, widthCm: 50, heightCm: 50, extraIds: [], quantity: 1 };
    const { order } = await createOrder({ items: [item], customer: { ...customer, deliveryMethod: "STOP_DESK" } }, { userId: null, locale: "fr" });
    expect(order).toMatchObject({ deliveryMethod: "STOP_DESK", deliveryFee: 430, total: 3_430 });
    await prisma.deliveryRule.create({ data: { wilayaCode: "54", fee: 1600 } });
    await expect(createOrder({ items: [item], customer: { ...customer, wilayaCode: "54", commune: "Ain Guezzam", deliveryMethod: "STOP_DESK" } }, { userId: null, locale: "fr" })).rejects.toMatchObject({ code: "checkout.stopDeskUnavailable" });
  });

  it("re-ordering before delivery joins the same parcel (no second fee); after delivery it is a new delivery", async () => {
    const admin = await createUser("ADMIN");
    await prisma.deliveryRule.create({ data: rule });
    const { product } = await createProductFixture();
    const item = { productId: product.id, widthCm: 50, heightCm: 50, extraIds: [], quantity: 1 };
    const { order: first } = await createOrder({ items: [item], customer }, { userId: null, locale: "fr" });
    const { order: second } = await createOrder({ items: [item], customer }, { userId: null, locale: "fr" });
    expect(first.deliveryFee).toBe(500);
    expect(second).toMatchObject({ shipsWithId: first.id, deliveryFee: 0, total: 3_000 });
    expect(memoryProvider.outbox.at(-1)?.html).toContain(`livrée avec ${first.orderNumber}`);

    // A different commune is a different parcel.
    const { order: elsewhere } = await createOrder({ items: [item], customer: { ...customer, commune: "Hydra" } }, { userId: null, locale: "fr" });
    expect(elsewhere.shipsWithId).toBeNull();

    // Separate by hand → its own fee again.
    expect((await separateDelivery(second.id, admin)).total).toBe(3_500);

    // Once the first order is delivered, a new order is a new delivery.
    await updateOrderStatus(first.id, "DELIVERED", admin);
    const { order: later } = await createOrder({ items: [item], customer }, { userId: null, locale: "fr" });
    expect(later.shipsWithId).not.toBe(first.id);
  });

  it("cancelling the lead order moves the delivery to the next order of the group", async () => {
    const admin = await createUser("ADMIN");
    await prisma.deliveryRule.create({ data: rule });
    const { product } = await createProductFixture();
    const item = { productId: product.id, widthCm: 50, heightCm: 50, extraIds: [], quantity: 1 };
    const { order: lead } = await createOrder({ items: [item], customer }, { userId: null, locale: "fr" });
    const { order: b } = await createOrder({ items: [item], customer }, { userId: null, locale: "fr" });
    const { order: c } = await createOrder({ items: [item], customer }, { userId: null, locale: "fr" });
    await updateOrderStatus(lead.id, "CANCELLED", admin);
    const [nb, nc] = await Promise.all([prisma.order.findUniqueOrThrow({ where: { id: b.id } }), prisma.order.findUniqueOrThrow({ where: { id: c.id } })]);
    expect(nb).toMatchObject({ shipsWithId: null, deliveryFee: 500, total: 3_500 });
    expect(nc).toMatchObject({ shipsWithId: b.id, deliveryFee: 0 });
  });
});

describe("Going back to the previous status", () => {
  it("undoes the last step, is recorded, and never re-sends the confirmation email", async () => {
    const admin = await createUser("ADMIN");
    const { order } = await placeOrder();
    await updateOrderStatus(order.id, "CONFIRMED", admin);
    await updateOrderStatus(order.id, "DELIVERED", admin);
    memoryProvider.reset();
    expect((await revertOrderStatus(order.id, admin)).order.status).toBe("CONFIRMED");
    expect((await revertOrderStatus(order.id, admin)).order.status).toBe("PENDING");
    expect((await updateOrderStatus(order.id, "CONFIRMED", admin)).email).toBeNull(); // already confirmed once
    expect(memoryProvider.outbox).toHaveLength(0);
    const last = await prisma.orderStatusHistory.findFirstOrThrow({ where: { orderId: order.id, note: { contains: "Retour au statut précédent" } } });
    expect(last.changedById).toBe(admin.id);
    const { order: fresh } = await placeOrder();
    await expect(revertOrderStatus(fresh.id, admin)).rejects.toMatchObject({ code: "order.noPreviousStatus" });
  });
});

describe("Exchange for anything", () => {
  it("records another product with its measure, frame and options, priced by the engine", async () => {
    const admin = await createUser("ADMIN");
    const { product } = await createProductFixture();
    const { product: other, frame, extra } = await createProductFixture(surMesureFixture);
    const { order } = await createOrder({ items: [{ productId: product.id, widthCm: 50, heightCm: 50, extraIds: [], quantity: 1 }], customer }, { userId: null, locale: "fr" });
    await updateOrderStatus(order.id, "DELIVERED", admin);
    const req = await createReturnRequest(
      order.id,
      { type: "EXCHANGE", reason: "Changement d'avis", orderItemId: order.items[0].id, replacement: { productId: other.id, widthCm: 70, heightCm: 90, frameId: frame.id, extraIds: [extra.id] } },
      { source: "ADMIN", actorId: admin.id },
    );
    expect(req).toMatchObject({ replacementProductId: other.id, replacementFrameName: "Cadre test", replacementPricingType: "SUR_MESURE", replacementPrice: 5_400 + 1_000 + 2_500 });
    expect(req.replacementExtras).toEqual([{ id: extra.id, name: "LED test", price: 2_500 }]);
  });
});
