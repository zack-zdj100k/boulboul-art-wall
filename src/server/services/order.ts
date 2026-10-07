import "server-only";
import { randomBytes } from "node:crypto";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { getWilaya } from "@/lib/algeria";
import { findCommune } from "@/lib/communes";
import type { CreateOrderInput } from "@/lib/validation";
import type { Locale } from "@/i18n/config";
import { prisma, type Tx } from "@/server/db";
import { sendNewOrderAdminEmail, sendOrderConfirmedCustomerEmail, sendOrderDeliveredCustomerEmail } from "@/server/email/service";
import type { EmailOrder, EmailOrderItem } from "@/server/email/types";
import { AppError, badRequest } from "@/server/http";
import { mediaUrl } from "@/server/storage";
import { audit } from "./audit";
import { nextOrderNumber } from "./counters";
import { norm, quoteDelivery, type DeliveryMethod } from "./delivery";
import {
  calculateNegotiatedPrice,
  calculateOrderTotal,
  calculatePromotion,
  getProductPrice,
  priceLine,
  PricingError,
  type LineQuote,
  type NegotiationInput,
} from "./pricing";
import { getPurchasableProducts, toPricingProduct } from "./product";
import { snapshotExtras } from "./extras";

// OrderService — prices, persists and manages orders. Every amount is computed here by the
// pricing engine from the database; amounts sent by the browser are ignored. Negotiations and
// dimension changes only touch the order (never the product price tables) and are recorded in
// OrderPriceAdjustment, the order's complete negotiation history.

// Forward moves may skip steps (e.g. confirmed on the first call, or picked up and delivered at
// once); delivered and cancelled orders are final.
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONTACTING", "CONFIRMED", "DELIVERED", "CANCELLED"],
  CONTACTING: ["CONFIRMED", "DELIVERED", "CANCELLED"],
  CONFIRMED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

/** Statuses in which a manager may still negotiate, change dimensions or the delivery fee. */
export const EDITABLE_STATUSES: OrderStatus[] = ["PENDING", "CONTACTING", "CONFIRMED"];

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return ORDER_TRANSITIONS[from].includes(to);
}

/**
 * The only transition that notifies the customer: PENDING / CONTACTING → CONFIRMED, and only the
 * first time (re-confirming after going back a step does not send it again).
 */
export function shouldEmailCustomer(from: OrderStatus, to: OrderStatus, alreadyConfirmed = false) {
  return (from === "PENDING" || from === "CONTACTING") && to === "CONFIRMED" && !alreadyConfirmed;
}

export const orderEmailInclude = { items: true, shipsWith: { select: { orderNumber: true } } } satisfies Prisma.OrderInclude;
type OrderForEmail = Prisma.OrderGetPayload<{ include: typeof orderEmailInclude }>;

export function toEmailOrder(o: OrderForEmail): EmailOrder {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    publicToken: o.publicToken,
    customerName: o.customerName,
    email: o.email,
    phone: o.phone,
    wilayaCode: o.wilayaCode,
    wilayaName: o.wilayaName,
    commune: o.commune,
    address: o.address,
    notes: o.notes,
    subtotal: o.subtotal,
    negotiatedDiscount: o.negotiatedDiscount,
    deliveryFee: o.deliveryFee,
    deliveryMethod: o.deliveryMethod,
    shipsWith: o.shipsWith?.orderNumber ?? null,
    total: o.total,
    status: o.status,
    locale: o.locale,
    createdAt: o.createdAt,
    items: o.items.map((i) => ({
      productName: i.productName,
      productImageUrl: i.productImageUrl,
      widthCm: i.widthCm,
      heightCm: i.heightCm,
      pricingType: i.pricingType,
      pricingLabel: i.pricingLabel,
      officialPrice: i.officialPrice,
      promotionType: i.promotionType,
      promotionValue: i.promotionValue,
      promotionDiscount: i.promotionDiscount,
      priceAfterPromotion: i.priceAfterPromotion,
      optionsPrice: i.optionsPrice,
      frameName: i.frameName,
      color: i.color,
      extras: (i.extras as EmailOrderItem["extras"]) ?? [],
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
    })),
  };
}

type PricedItem = {
  productId: string;
  productName: string;
  productSlug: string;
  productImageUrl: string | null;
  color: string | null;
  quote: LineQuote;
};

function asBadRequest(err: unknown): never {
  if (err instanceof PricingError) throw badRequest(err.code);
  throw err;
}

/** Price a full order with the pricing engine (also used for the checkout summary). */
export async function quoteOrder(input: Pick<CreateOrderInput, "items"> & { wilayaCode?: string; commune?: string; deliveryMethod?: DeliveryMethod }) {
  const products = await getPurchasableProducts([...new Set(input.items.map((i) => i.productId))]);
  const now = new Date();

  const items: PricedItem[] = input.items.map((item) => {
    const product = products.get(item.productId);
    if (!product) throw new AppError(409, "errors.productUnavailable");
    if (item.color && product.colors.length && !product.colors.includes(item.color)) throw badRequest("errors.invalidOption");
    try {
      const line = priceLine(toPricingProduct(product), item, now);
      const quote: LineQuote = {
        ...line,
        extras: snapshotExtras(line.extras, product.extras.map((pe) => pe.extra), item.extraChoices) as LineQuote["extras"],
      };
      const image = product.images[0]?.media;
      return {
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        productImageUrl: image ? mediaUrl(image.key) : null,
        color: item.color && product.colors.includes(item.color) ? item.color : null,
        quote,
      };
    } catch (err) {
      return asBadRequest(err);
    }
  });

  const subtotal = items.reduce((s, i) => s + i.quote.total, 0);
  const method = input.deliveryMethod ?? "HOME";
  let delivery: ReturnType<typeof quoteDelivery> = { fee: null, free: false, ruleId: null, method, home: null, stopDesk: null };
  if (input.wilayaCode) {
    const rules = await prisma.deliveryRule.findMany({ where: { isActive: true } });
    delivery = quoteDelivery(rules, input.wilayaCode, input.commune ?? "", subtotal, method);
  }
  const totals = calculateOrderTotal({ subtotal, negotiatedDiscount: 0, deliveryFee: delivery.fee });
  return { items, subtotal, delivery, total: totals.total };
}

/** Snapshot columns of an order item for a priced line. */
function itemSnapshot(q: LineQuote) {
  return {
    widthCm: q.widthCm,
    heightCm: q.heightCm,
    pricingType: q.pricingType,
    pricingRefId: q.pricingRefId,
    pricingLabel: q.pricingLabel,
    officialPrice: q.officialPrice,
    promotionType: q.promotion?.type ?? null,
    promotionValue: q.promotion?.value ?? null,
    promotionDiscount: q.promotionDiscount,
    priceAfterPromotion: q.priceAfterPromotion,
    optionsPrice: q.optionsPrice,
    quantity: q.quantity,
    unitPrice: q.unitPrice,
    totalPrice: q.total,
    pricingBreakdown: q as unknown as Prisma.InputJsonValue,
  };
}

/** Statuses in which an order has not left yet, so a new order can join its delivery. */
export const OPEN_FOR_GROUPING: OrderStatus[] = ["PENDING", "CONTACTING", "CONFIRMED"];

/**
 * KING 253 "ships with": the same customer (account or phone) orders again for the same
 * destination and delivery method while a previous order is not delivered yet → one parcel,
 * the delivery is charged once, on that earlier (lead) order. Once it is delivered, a new order
 * is a new delivery.
 */
export async function findGroupLead(tx: Tx, c: { userId: string | null; phone: string; wilayaCode: string; commune: string; deliveryMethod: DeliveryMethod }) {
  const candidates = await tx.order.findMany({
    where: {
      status: { in: OPEN_FOR_GROUPING },
      shipsWithId: null,
      wilayaCode: c.wilayaCode,
      deliveryMethod: c.deliveryMethod,
      OR: [{ phone: c.phone }, ...(c.userId ? [{ userId: c.userId }] : [])],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, orderNumber: true, commune: true },
  });
  return candidates.find((o) => norm(o.commune) === norm(c.commune)) ?? null;
}

export async function createOrder(input: CreateOrderInput, opts: { userId: string | null; locale: Locale }) {
  const wilaya = getWilaya(input.customer.wilayaCode);
  if (!wilaya) throw badRequest("validation.wilaya", { "customer.wilayaCode": "validation.wilaya" });
  const method: DeliveryMethod = input.customer.deliveryMethod ?? "HOME";
  const commune = await findCommune(wilaya.code, input.customer.commune);
  if (!commune) throw badRequest("validation.commune", { "customer.commune": "validation.commune" });

  const quote = await quoteOrder({ items: input.items, wilayaCode: wilaya.code, commune, deliveryMethod: method });
  if (method === "STOP_DESK" && quote.delivery.ruleId && quote.delivery.stopDesk == null) throw badRequest("checkout.stopDeskUnavailable", { "customer.deliveryMethod": "checkout.stopDeskUnavailable" });
  const c = input.customer;

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await nextOrderNumber(tx);
    const lead = await findGroupLead(tx, { userId: opts.userId, phone: c.phone, wilayaCode: wilaya.code, commune, deliveryMethod: method });
    const deliveryFee = lead ? 0 : quote.delivery.fee;
    const totals = calculateOrderTotal({ subtotal: quote.subtotal, negotiatedDiscount: 0, deliveryFee });
    return tx.order.create({
      data: {
        orderNumber,
        publicToken: randomBytes(24).toString("base64url"),
        userId: opts.userId,
        customerName: c.customerName,
        email: c.email,
        phone: c.phone,
        wilayaCode: wilaya.code,
        wilayaName: wilaya.fr,
        commune,
        address: c.address,
        notes: c.notes ?? null,
        subtotal: quote.subtotal,
        negotiatedDiscount: 0,
        deliveryFee,
        deliveryMethod: method,
        shipsWithId: lead?.id ?? null,
        total: totals.total,
        status: "PENDING",
        locale: opts.locale,
        items: {
          create: quote.items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            productSlug: i.productSlug,
            productImageUrl: i.productImageUrl,
            frameId: i.quote.frame?.id ?? null,
            frameName: i.quote.frame?.name ?? null,
            color: i.color,
            extras: i.quote.extras,
            ...itemSnapshot(i.quote),
          })),
        },
        history: {
          create: {
            fromStatus: null,
            toStatus: "PENDING",
            changedById: opts.userId,
            note: lead ? `Commande passée sur le site — livrée avec ${lead.orderNumber} (frais de livraison déjà comptés)` : "Commande passée sur le site",
          },
        },
      },
      include: orderEmailInclude,
    });
  });

  // EMAIL 1 — new order → admin. Never rolls back the order on failure.
  const email = await sendNewOrderAdminEmail(toEmailOrder(order));
  return { order, email };
}

/**
 * A lead order of a grouped delivery is cancelled: the next order of the group carries the
 * delivery (its fee is looked up again) and the others now ship with it.
 */
async function regroupAfterCancel(tx: Tx, leadId: string, actorId: string) {
  const followers = await tx.order.findMany({ where: { shipsWithId: leadId, status: { in: OPEN_FOR_GROUPING } }, orderBy: { createdAt: "asc" } });
  await tx.order.updateMany({ where: { shipsWithId: leadId, status: { notIn: OPEN_FOR_GROUPING } }, data: { shipsWithId: null } });
  if (!followers.length) return;
  const [next, ...rest] = followers;
  const rules = await tx.deliveryRule.findMany({ where: { isActive: true } });
  const fee = quoteDelivery(rules, next.wilayaCode, next.commune, next.subtotal, next.deliveryMethod).fee;
  const totals = calculateOrderTotal({ subtotal: next.subtotal, negotiatedDiscount: next.negotiatedDiscount, deliveryFee: fee });
  await tx.order.update({ where: { id: next.id }, data: { shipsWithId: null, deliveryFee: fee, total: totals.total } });
  await tx.orderPriceAdjustment.create({
    data: {
      orderId: next.id,
      kind: "DELIVERY_FEE",
      previousPrice: totals.finalProductPrice,
      newPrice: totals.finalProductPrice,
      previousTotal: next.total,
      newTotal: totals.total,
      details: { from: next.deliveryFee, to: fee },
      note: "La commande principale de la livraison groupée a été annulée : cette commande porte maintenant la livraison.",
      actorId,
    },
  });
  if (rest.length) await tx.order.updateMany({ where: { id: { in: rest.map((o) => o.id) } }, data: { shipsWithId: next.id } });
}

async function applyStatus(orderId: string, to: OrderStatus, actor: { id: string }, opts: { note?: string | null; revert?: boolean }) {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: orderId }, select: { status: true, confirmedAt: true } });
    if (!current) throw new AppError(404, "errors.notFound");
    const from = current.status;
    if (from === to) throw new AppError(409, "order.sameStatus");
    if (!opts.revert && !canTransition(from, to)) throw new AppError(409, "order.invalidTransition");

    // Conditional update guards against two admins changing the same order concurrently.
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: from },
      data: { status: to, ...(to === "CONFIRMED" && !current.confirmedAt ? { confirmedAt: new Date() } : {}) },
    });
    if (updated.count !== 1) throw new AppError(409, "order.concurrentUpdate");

    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: from, toStatus: to, changedById: actor.id, note: opts.revert ? [REVERT_NOTE, opts.note].filter(Boolean).join(" — ") : opts.note || null },
    });
    if (to === "CANCELLED") await regroupAfterCancel(tx, orderId, actor.id);
    await audit({ actorId: actor.id, action: opts.revert ? "order.status.revert" : "order.status", entityType: "Order", entityId: orderId, metadata: { from, to } }, tx);
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderEmailInclude });
    return { from, order, alreadyConfirmed: !!current.confirmedAt };
  });

  // Customer emails: confirmation (PENDING/CONTACTING → CONFIRMED, first time) and delivery
  // (→ DELIVERED, once). Each can be turned off in Paramètres → E-mails. Undo never sends.
  let email: Awaited<ReturnType<typeof sendOrderConfirmedCustomerEmail>> = null;
  if (shouldEmailCustomer(result.from, to, result.alreadyConfirmed)) email = await sendOrderConfirmedCustomerEmail(toEmailOrder(result.order));
  else if (to === "DELIVERED" && !opts.revert) {
    const already = await prisma.emailLog.count({ where: { orderId, type: "ORDER_DELIVERED_CUSTOMER", status: "SENT" } });
    if (!already) email = await sendOrderDeliveredCustomerEmail(toEmailOrder(result.order));
  }
  return { order: result.order, from: result.from, email };
}

export async function updateOrderStatus(orderId: string, to: OrderStatus, actor: { id: string }, note?: string | null) {
  return applyStatus(orderId, to, actor, { note });
}

const REVERT_NOTE = "Retour au statut précédent";

/**
 * The status this order had before its current one (undo a mistake), or null. History is read
 * as a stack: each step pushes a status, each undo pops one — so undoing twice goes two steps back.
 */
export async function previousStatus(orderId: string) {
  const history = await prisma.orderStatusHistory.findMany({ where: { orderId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { toStatus: true, note: true } });
  const stack: OrderStatus[] = [];
  for (const h of history) {
    if (h.note?.startsWith(REVERT_NOTE)) stack.pop();
    else stack.push(h.toStatus);
  }
  return stack.length >= 2 ? stack[stack.length - 2] : null;
}

/** Go back to the previous status (e.g. a manager clicked the wrong step). Recorded in the timeline. */
export async function revertOrderStatus(orderId: string, actor: { id: string }, note?: string | null) {
  const to = await previousStatus(orderId);
  if (!to) throw new AppError(409, "order.noPreviousStatus");
  return applyStatus(orderId, to, actor, { note, revert: true });
}

/** Ship an order on its own again (its delivery fee is looked up from the rules). */
export async function separateDelivery(orderId: string, actor: { id: string }) {
  return prisma.$transaction(async (tx) => {
    const order = await loadEditableOrder(tx, orderId);
    if (!order.shipsWithId) throw new AppError(409, "order.notGrouped");
    const rules = await tx.deliveryRule.findMany({ where: { isActive: true } });
    const fee = quoteDelivery(rules, order.wilayaCode, order.commune, order.subtotal, order.deliveryMethod).fee;
    const totals = calculateOrderTotal({ subtotal: order.subtotal, negotiatedDiscount: order.negotiatedDiscount, deliveryFee: fee });
    await tx.order.update({ where: { id: orderId }, data: { shipsWithId: null, deliveryFee: fee, total: totals.total } });
    await tx.orderPriceAdjustment.create({
      data: {
        orderId,
        kind: "DELIVERY_FEE",
        previousPrice: totals.finalProductPrice,
        newPrice: totals.finalProductPrice,
        previousTotal: order.total,
        newTotal: totals.total,
        details: { from: order.deliveryFee, to: fee },
        note: "Livraison séparée de la commande groupée",
        actorId: actor.id,
      },
    });
    await audit({ actorId: actor.id, action: "order.delivery.separate", entityType: "Order", entityId: orderId }, tx);
    return totals;
  });
}

// ───────────────────────── Manager price changes (per order only)

type OrderForEdit = Prisma.OrderGetPayload<{ include: { items: true } }>;

async function loadEditableOrder(tx: Tx, orderId: string): Promise<OrderForEdit> {
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: { orderBy: { id: "asc" } } } });
  if (!order) throw new AppError(404, "errors.notFound");
  if (!EDITABLE_STATUSES.includes(order.status)) throw new AppError(409, "order.closed");
  return order;
}

/** Writes new amounts with an optimistic lock on `updatedAt` (two managers on the same order). */
async function saveAmounts(tx: Tx, order: OrderForEdit, data: { subtotal: number; negotiatedDiscount: number; deliveryFee: number | null }) {
  const totals = calculateOrderTotal(data);
  const res = await tx.order.updateMany({
    where: { id: order.id, updatedAt: order.updatedAt },
    data: { subtotal: totals.subtotal, negotiatedDiscount: totals.negotiatedDiscount, deliveryFee: totals.deliveryFee, total: totals.total },
  });
  if (res.count !== 1) throw new AppError(409, "order.concurrentUpdate");
  return totals;
}

/**
 * Negotiate the order's price: sets the negotiated discount applied to the products after
 * promotion (AMOUNT in DA or PERCENT). Replaces any previous negotiation of this order and is
 * appended to the negotiation history. The product's official prices are untouched.
 */
export async function negotiateOrder(orderId: string, input: NegotiationInput & { note?: string | null }, actor: { id: string }) {
  return prisma.$transaction(async (tx) => {
    const order = await loadEditableOrder(tx, orderId);
    let negotiated: ReturnType<typeof calculateNegotiatedPrice>;
    try {
      negotiated = calculateNegotiatedPrice(order.subtotal, input);
    } catch (err) {
      return asBadRequest(err);
    }
    if (negotiated.discount === order.negotiatedDiscount) throw new AppError(409, "order.negotiationUnchanged");
    const previousPrice = order.subtotal - order.negotiatedDiscount;
    const totals = await saveAmounts(tx, order, { subtotal: order.subtotal, negotiatedDiscount: negotiated.discount, deliveryFee: order.deliveryFee });
    await tx.orderPriceAdjustment.create({
      data: {
        orderId,
        kind: "NEGOTIATION",
        previousPrice,
        newPrice: totals.finalProductPrice,
        discountAmount: negotiated.discount,
        discountPercent: negotiated.percent,
        previousTotal: order.total,
        newTotal: totals.total,
        details: { input: { type: input.type, value: input.value }, priceAfterPromotion: order.subtotal, previousDiscount: order.negotiatedDiscount },
        note: input.note || null,
        actorId: actor.id,
      },
    });
    await audit({ actorId: actor.id, action: "order.negotiate", entityType: "Order", entityId: orderId, metadata: { from: order.negotiatedDiscount, to: negotiated.discount, total: totals.total } }, tx);
    return totals;
  });
}

/** Re-price one order line for new dimensions with the pricing engine (options keep their snapshot). */
export async function repriceItem(item: OrderForEdit["items"][number], widthCm: number, heightCm: number, now = new Date()) {
  if (!item.productId) throw new AppError(409, "order.productMissing");
  const product = await prisma.product.findUnique({
    where: { id: item.productId },
    select: { id: true, promoType: true, promoValue: true, promoStartsAt: true, promoEndsAt: true },
  });
  if (!product) throw new AppError(409, "order.productMissing");
  if (!Number.isInteger(widthCm) || !Number.isInteger(heightCm) || widthCm <= 0 || heightCm <= 0) throw badRequest("errors.invalidSize");
  const lookup = await getProductPrice(product.id, widthCm, heightCm);
  if (!lookup) throw badRequest("pricing.needsSurMesure");
  const promo = calculatePromotion(lookup.price, product, now);
  const previous = (item.pricingBreakdown ?? {}) as Partial<LineQuote>;
  const unitPrice = promo.priceAfterPromotion + item.optionsPrice;
  const quote: LineQuote = {
    widthCm,
    heightCm,
    pricingType: lookup.source,
    pricingRefId: lookup.refId,
    pricingLabel: lookup.label,
    surMesure: lookup.surMesure,
    officialPrice: lookup.price,
    promotion: promo.active ? { type: promo.type!, value: promo.value! } : null,
    promotionDiscount: promo.discount,
    priceAfterPromotion: promo.priceAfterPromotion,
    frame: previous.frame ?? (item.frameId ? { id: item.frameId, name: item.frameName ?? "", price: 0 } : null),
    extras: (item.extras as LineQuote["extras"]) ?? [],
    optionsPrice: item.optionsPrice,
    unitPrice,
    quantity: item.quantity,
    total: unitPrice * item.quantity,
  };
  return quote;
}

/** Preview for the admin UI — same computation as the real change, nothing is saved. */
export async function previewDimensionChange(orderId: string, itemId: string, widthCm: number, heightCm: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: { orderBy: { id: "asc" } } } });
  if (!order) throw new AppError(404, "errors.notFound");
  const item = order.items.find((i) => i.id === itemId);
  if (!item) throw new AppError(404, "errors.notFound");
  const quote = await repriceItem(item, widthCm, heightCm);
  const subtotal = order.items.reduce((s, i) => s + (i.id === itemId ? quote.total : i.totalPrice), 0);
  // A dimension change clears the negotiation; the manager negotiates again if needed.
  const totals = calculateOrderTotal({ subtotal, negotiatedDiscount: 0, deliveryFee: order.deliveryFee });
  return { quote, totals };
}

/**
 * Manager changes the dimensions of an order line: the official price is looked up again
 * (special → standard), the current promotion applied, a new snapshot saved, and the previous
 * negotiated discount cleared (re-negotiate if needed). Recorded in the history.
 */
export async function changeOrderDimensions(
  orderId: string,
  input: { itemId: string; widthCm: number; heightCm: number; note?: string | null },
  actor: { id: string },
) {
  return prisma.$transaction(async (tx) => {
    const order = await loadEditableOrder(tx, orderId);
    const item = order.items.find((i) => i.id === input.itemId);
    if (!item) throw new AppError(404, "errors.notFound");
    if (item.widthCm === input.widthCm && item.heightCm === input.heightCm) throw new AppError(409, "order.dimensionsUnchanged");
    const quote = await repriceItem(item, input.widthCm, input.heightCm);

    await tx.orderItem.update({ where: { id: item.id }, data: itemSnapshot(quote) });
    const subtotal = order.items.reduce((s, i) => s + (i.id === item.id ? quote.total : i.totalPrice), 0);
    const previousPrice = order.subtotal - order.negotiatedDiscount;
    const totals = await saveAmounts(tx, order, { subtotal, negotiatedDiscount: 0, deliveryFee: order.deliveryFee });
    await tx.orderPriceAdjustment.create({
      data: {
        orderId,
        kind: "DIMENSION_CHANGE",
        previousPrice,
        newPrice: totals.finalProductPrice,
        previousTotal: order.total,
        newTotal: totals.total,
        details: {
          itemId: item.id,
          product: item.productName,
          from: { widthCm: item.widthCm, heightCm: item.heightCm, pricingType: item.pricingType, officialPrice: item.officialPrice, priceAfterPromotion: item.priceAfterPromotion },
          to: { widthCm: quote.widthCm, heightCm: quote.heightCm, pricingType: quote.pricingType, officialPrice: quote.officialPrice, priceAfterPromotion: quote.priceAfterPromotion },
          clearedNegotiation: order.negotiatedDiscount,
        },
        note: input.note || null,
        actorId: actor.id,
      },
    });
    await audit({ actorId: actor.id, action: "order.dimensions", entityType: "Order", entityId: orderId, metadata: { itemId: item.id, from: `${item.widthCm}x${item.heightCm}`, to: `${quote.widthCm}x${quote.heightCm}`, total: totals.total } }, tx);
    return totals;
  });
}

/** Set (or clear → "to confirm") the delivery fee of an order. */
export async function setOrderDeliveryFee(orderId: string, input: { deliveryFee: number | null; note?: string | null }, actor: { id: string }) {
  return prisma.$transaction(async (tx) => {
    const order = await loadEditableOrder(tx, orderId);
    if (order.deliveryFee === input.deliveryFee) throw new AppError(409, "order.deliveryUnchanged");
    let totals: ReturnType<typeof calculateOrderTotal>;
    try {
      totals = await saveAmounts(tx, order, { subtotal: order.subtotal, negotiatedDiscount: order.negotiatedDiscount, deliveryFee: input.deliveryFee });
    } catch (err) {
      return asBadRequest(err);
    }
    const price = order.subtotal - order.negotiatedDiscount;
    await tx.orderPriceAdjustment.create({
      data: {
        orderId,
        kind: "DELIVERY_FEE",
        previousPrice: price,
        newPrice: price,
        previousTotal: order.total,
        newTotal: totals.total,
        details: { from: order.deliveryFee, to: input.deliveryFee },
        note: input.note || null,
        actorId: actor.id,
      },
    });
    await audit({ actorId: actor.id, action: "order.delivery", entityType: "Order", entityId: orderId, metadata: { from: order.deliveryFee, to: input.deliveryFee } }, tx);
    return totals;
  });
}

/** Private manager notes (never shown to the customer). */
export async function updateManagerNotes(orderId: string, notes: string | null, actor: { id: string }) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) throw new AppError(404, "errors.notFound");
  await prisma.order.update({ where: { id: orderId }, data: { managerNotes: notes || null } });
  await audit({ actorId: actor.id, action: "order.notes", entityType: "Order", entityId: orderId });
}

/** Manual retry from the admin order page, restricted to the two allowed emails and their conditions. */
export async function retryOrderEmail(orderId: string, type: "NEW_ORDER_ADMIN" | "ORDER_CONFIRMED_CUSTOMER" | "ORDER_DELIVERED_CUSTOMER", actorId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderEmailInclude });
  if (!order) throw new AppError(404, "errors.notFound");
  if (type === "ORDER_CONFIRMED_CUSTOMER" && !order.confirmedAt) throw new AppError(409, "order.notConfirmed");
  if (type === "ORDER_DELIVERED_CUSTOMER" && order.status !== "DELIVERED") throw new AppError(409, "order.notDelivered");
  await audit({ actorId, action: "order.email.retry", entityType: "Order", entityId: orderId, metadata: { type } });
  if (type === "NEW_ORDER_ADMIN") return sendNewOrderAdminEmail(toEmailOrder(order));
  // A manual retry is sent even if that email type was turned off afterwards.
  const res = type === "ORDER_CONFIRMED_CUSTOMER" ? await sendOrderConfirmedCustomerEmail(toEmailOrder(order), { force: true }) : await sendOrderDeliveredCustomerEmail(toEmailOrder(order), { force: true });
  return res ?? { ok: false };
}

/**
 * Permanently delete an order (admin). Items, history, negotiations and returns go with it;
 * email logs are kept (unlinked). The audit log keeps the number and total for traceability.
 */
export async function deleteOrder(orderId: string, actorId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true, total: true, status: true, customerName: true } });
  if (!order) throw new AppError(404, "errors.notFound");
  await prisma.order.delete({ where: { id: orderId } });
  await audit({ actorId, action: "order.delete", entityType: "Order", entityId: orderId, metadata: order });
}
