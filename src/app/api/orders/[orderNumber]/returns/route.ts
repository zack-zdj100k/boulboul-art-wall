import { NextResponse } from "next/server";
import { z } from "zod";
import { RETURN_REASONS } from "@/shared/lib/returns";
import { returnRequestSchema } from "@/shared/lib/validation";
import { canAccessOrder } from "@/backend/auth/order-access";
import { prisma } from "@/backend/db";
import { clientIp, notFound, parseJson, publicRoute } from "@/backend/http";
import { rateLimit } from "@/backend/rate-limit";
import { cancelOwnReturnRequest, createReturnRequest } from "@/backend/services/returns";

async function ownOrder(orderNumber: string, user: Parameters<typeof canAccessOrder>[1], token?: string) {
  const order = await prisma.order.findUnique({ where: { orderNumber: decodeURIComponent(orderNumber) }, select: { id: true, userId: true, publicToken: true } });
  if (!order || !canAccessOrder(order, user, token)) throw notFound("order.notFound");
  return order;
}

/** Customer return / exchange request on their own delivered order (owner or private-link holder). */
export const POST = publicRoute<{ orderNumber: string }>(async (req, { params, user }) => {
  rateLimit(`returns:${clientIp(req)}`, 10, 60 * 60_000);
  const input = await parseJson(req, returnRequestSchema);
  const order = await ownOrder(params.orderNumber, user, input.token);
  const replacement = input.type === "EXCHANGE" && input.replacementWidthCm && input.replacementHeightCm ? { widthCm: input.replacementWidthCm, heightCm: input.replacementHeightCm } : null;
  const request = await createReturnRequest(
    order.id,
    { type: input.type, orderItemId: input.orderItemId, quantity: input.quantity, reason: RETURN_REASONS[input.reason], details: input.details, replacement },
    { source: "CUSTOMER", actorId: user?.id ?? null },
  );
  return NextResponse.json({ id: request.id, status: request.status }, { status: 201 });
});

/** Withdraw a request that has not been reviewed yet. */
export const DELETE = publicRoute<{ orderNumber: string }>(async (req, { params, user }) => {
  const q = z.object({ id: z.string().min(1).max(64), token: z.string().max(200).optional() }).parse({ id: req.nextUrl.searchParams.get("id"), token: req.nextUrl.searchParams.get("token") ?? undefined });
  const order = await ownOrder(params.orderNumber, user, q.token);
  await cancelOwnReturnRequest(q.id, order.id, user?.id ?? null);
  return NextResponse.json({ cancelled: true });
});
