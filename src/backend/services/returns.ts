import "server-only";
import type { ReturnStatus, ReturnType as ReturnKind } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/db";
import { AppError, badRequest } from "@/backend/http";
import { audit } from "./audit";
import { priceLine, PricingError } from "./pricing";
import { getPricingProductOrThrow } from "./product";

// ReturnService — return / exchange requests on delivered orders (structure adapted from
// KING 253, without any stock logic: Boulboul's pieces are made to order). The policy itself is
// CMS content ("legal.returns"). Requests never modify the order's price snapshot, and no email
// is sent (only the two order emails exist).

export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ["UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["RETURN_RECEIVED", "EXCHANGE_PROCESSING", "COMPLETED", "CANCELLED"],
  RETURN_RECEIVED: ["EXCHANGE_PROCESSING", "COMPLETED", "CANCELLED"],
  EXCHANGE_PROCESSING: ["COMPLETED", "CANCELLED"],
  REJECTED: [],
  COMPLETED: [],
  CANCELLED: [],
};

export const OPEN_RETURN_STATUSES: ReturnStatus[] = ["REQUESTED", "UNDER_REVIEW", "APPROVED", "RETURN_RECEIVED", "EXCHANGE_PROCESSING"];
/** Requests that no longer cover any unit of the item. */
const RELEASED: ReturnStatus[] = ["REJECTED", "CANCELLED"];

/** Allowed next statuses for a request ("exchange processing" only exists for exchanges). */
export function nextReturnStatuses(type: ReturnKind, from: ReturnStatus) {
  return RETURN_TRANSITIONS[from].filter((s) => type === "EXCHANGE" || s !== "EXCHANGE_PROCESSING");
}

/** Units of each item of an order not yet covered by a return / exchange request. */
export async function returnableQuantities(orderId: string) {
  const [items, requests] = await Promise.all([
    prisma.orderItem.findMany({ where: { orderId }, select: { id: true, quantity: true } }),
    prisma.returnRequest.findMany({ where: { orderId, status: { notIn: RELEASED } }, select: { orderItemId: true, quantity: true } }),
  ]);
  return new Map(items.map((i) => [i.id, i.quantity - requests.filter((r) => r.orderItemId === i.id).reduce((n, r) => n + r.quantity, 0)]));
}

export type Replacement = { productId?: string | null; widthCm: number; heightCm: number; frameId?: string | null; extraIds?: string[] };

/**
 * The piece the customer takes instead (any product, measure, frame, options), priced with the
 * shop's engine. `price` is per unit with options, after promotion; null when not priced online.
 */
export async function priceReplacement(productId: string | null, r: Replacement) {
  const id = r.productId || productId;
  if (!id) return null;
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!product) throw badRequest("errors.productUnavailable", { replacement: "errors.productUnavailable" });
  try {
    const q = priceLine(await getPricingProductOrThrow(id), { widthCm: r.widthCm, heightCm: r.heightCm, frameId: r.frameId, extraIds: r.extraIds ?? [] });
    return { productId: id, productName: product.name, pricingType: q.pricingType, price: q.unitPrice, frameName: q.frame?.name ?? null, extras: q.extras };
  } catch (err) {
    if (err instanceof PricingError && err.code === "pricing.needsSurMesure") return { productId: id, productName: product.name, pricingType: null, price: null, frameName: null, extras: [] };
    if (err instanceof PricingError) throw badRequest(err.code, { replacement: err.code });
    if (err instanceof AppError) return { productId: id, productName: product.name, pricingType: null, price: null, frameName: null, extras: [] };
    throw err;
  }
}

export type ReturnRequestInput = {
  type: ReturnKind;
  reason: string;
  details?: string | null;
  orderItemId?: string | null;
  quantity?: number;
  replacement?: Replacement | null;
  approve?: boolean;
};

export async function createReturnRequest(orderId: string, input: ReturnRequestInput, by: { source: "CUSTOMER" | "ADMIN"; actorId: string | null }) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, items: { select: { id: true, productId: true, widthCm: true, heightCm: true } } } });
  // (the replacement of an exchange is priced below with the shop's pricing engine)
  if (!order) throw new AppError(404, "errors.notFound");
  if (order.status !== "DELIVERED") throw new AppError(409, "returns.notDelivered");

  const item = input.orderItemId ? order.items.find((i) => i.id === input.orderItemId) : order.items[0];
  if (!item) throw badRequest("validation.invalid", { orderItemId: "validation.invalid" });
  const quantity = input.quantity ?? 1;
  const left = (await returnableQuantities(orderId)).get(item.id) ?? 0;
  if (left <= 0) throw new AppError(409, "returns.alreadyOpen");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > left) throw badRequest("returns.invalidQuantity", { quantity: "returns.invalidQuantity" });

  let replacement: ({ widthCm: number; heightCm: number } & NonNullable<Awaited<ReturnType<typeof priceReplacement>>>) | null = null;
  if (input.type === "EXCHANGE" && input.replacement) {
    const r = input.replacement;
    const sameProduct = !r.productId || r.productId === item.productId;
    const sameOptions = !r.frameId && !(r.extraIds ?? []).length;
    if (sameProduct && sameOptions && r.widthCm === item.widthCm && r.heightCm === item.heightCm) throw badRequest("returns.sameMeasure", { replacement: "returns.sameMeasure" });
    const priced = await priceReplacement(item.productId, r);
    if (priced) replacement = { widthCm: r.widthCm, heightCm: r.heightCm, ...priced };
  }
  if (input.type === "EXCHANGE" && by.source === "ADMIN" && !replacement) throw badRequest("returns.replacementRequired", { replacement: "returns.replacementRequired" });
  const approve = by.source === "ADMIN" && !!input.approve;

  return prisma.$transaction(async (tx) => {
    const request = await tx.returnRequest.create({
      data: {
        orderId,
        orderItemId: item.id,
        quantity,
        type: input.type,
        status: approve ? "APPROVED" : "REQUESTED",
        reason: input.reason,
        details: input.details || null,
        source: by.source,
        replacementWidthCm: replacement?.widthCm ?? null,
        replacementHeightCm: replacement?.heightCm ?? null,
        replacementPricingType: replacement?.pricingType ?? null,
        replacementPrice: replacement?.price ?? null,
        replacementProductId: replacement?.productId ?? null,
        replacementProductName: replacement?.productName ?? null,
        replacementFrameName: replacement?.frameName ?? null,
        replacementExtras: replacement ? replacement.extras : undefined,
        history: {
          create: [
            { fromStatus: null, toStatus: "REQUESTED", changedById: by.actorId, note: by.source === "ADMIN" ? "Enregistrée par un gestionnaire" : "Demandée par le client" },
            ...(approve ? [{ fromStatus: "REQUESTED" as const, toStatus: "APPROVED" as const, changedById: by.actorId, note: "Approuvée à l'enregistrement" }] : []),
          ],
        },
      },
    });
    await audit({ actorId: by.actorId, action: "return.create", entityType: "Order", entityId: orderId, metadata: { requestId: request.id, type: input.type, quantity, source: by.source, approved: approve } }, tx);
    return request;
  });
}

export async function updateReturnStatus(requestId: string, input: { status: ReturnStatus; note?: string | null; managerNote?: string | null }, actor: { id: string }) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.returnRequest.findUnique({ where: { id: requestId } });
    if (!current) throw new AppError(404, "errors.notFound");
    const statusChanged = input.status !== current.status;
    if (statusChanged && !nextReturnStatuses(current.type, current.status).includes(input.status)) throw new AppError(409, "returns.invalidTransition");
    const res = await tx.returnRequest.updateMany({
      where: { id: requestId, status: current.status },
      data: { status: input.status, ...(input.managerNote !== undefined ? { managerNote: input.managerNote || null } : {}) },
    });
    if (res.count !== 1) throw new AppError(409, "order.concurrentUpdate");
    if (statusChanged) await tx.returnStatusHistory.create({ data: { requestId, fromStatus: current.status, toStatus: input.status, changedById: actor.id, note: input.note || null } });
    await audit({ actorId: actor.id, action: "return.update", entityType: "Order", entityId: current.orderId, metadata: { requestId, from: current.status, to: input.status } }, tx);
    return tx.returnRequest.findUniqueOrThrow({ where: { id: requestId } });
  });
}

/** Admin: delete a request entirely (e.g. recorded by mistake). The order itself is unchanged. */
export async function deleteReturnRequest(requestId: string, actorId: string) {
  const current = await prisma.returnRequest.findUnique({ where: { id: requestId } });
  if (!current) throw new AppError(404, "errors.notFound");
  await prisma.returnRequest.delete({ where: { id: requestId } });
  await audit({ actorId, action: "return.delete", entityType: "Order", entityId: current.orderId, metadata: { requestId, type: current.type, status: current.status } });
}

/** The customer may withdraw a request that nobody has reviewed yet. */
export async function cancelOwnReturnRequest(requestId: string, orderId: string, actorId: string | null) {
  const current = await prisma.returnRequest.findFirst({ where: { id: requestId, orderId } });
  if (!current) throw new AppError(404, "errors.notFound");
  if (current.status !== "REQUESTED") throw new AppError(409, "returns.invalidTransition");
  await prisma.$transaction([
    prisma.returnRequest.update({ where: { id: requestId }, data: { status: "CANCELLED" } }),
    prisma.returnStatusHistory.create({ data: { requestId, fromStatus: "REQUESTED", toStatus: "CANCELLED", changedById: actorId, note: "Annulée par le client" } }),
  ]);
}

export async function listReturnRequests(filter: { status?: ReturnStatus | "OPEN" | "ALL"; q?: string }) {
  return prisma.returnRequest.findMany({
    where: {
      ...(filter.status === "OPEN" ? { status: { in: OPEN_RETURN_STATUSES } } : filter.status && filter.status !== "ALL" ? { status: filter.status } : {}),
      ...(filter.q
        ? { order: { OR: [{ orderNumber: { contains: filter.q, mode: "insensitive" } }, { customerName: { contains: filter.q, mode: "insensitive" } }, { phone: { contains: filter.q } }] } }
        : {}),
    },
    include: {
      order: { select: { id: true, orderNumber: true, customerName: true, phone: true, total: true } },
      orderItem: { select: { productName: true, widthCm: true, heightCm: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
