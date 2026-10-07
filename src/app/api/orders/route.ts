import { NextResponse } from "next/server";
import { createOrderSchema } from "@/lib/validation";
import { getLocale } from "@/i18n/server";
import { prisma } from "@/server/db";
import { clientIp, parseJson, publicRoute, unauthorized, userRoute } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { createOrder } from "@/server/services/order";

/** Placing an order requires a Boulboul account (401 for visitors who are not signed in). */
export const POST = userRoute(async (req, { user }) => {
  rateLimit(`order:${clientIp(req)}`, 10, 10 * 60_000);
  const input = await parseJson(req, createOrderSchema);
  const { order } = await createOrder(input, { userId: user.id, locale: await getLocale() });
  // Only what the confirmation page needs; the token lets a guest reopen their own order.
  return NextResponse.json({ orderNumber: order.orderNumber, token: order.publicToken, status: order.status, total: order.total }, { status: 201 });
});

/** The signed-in customer's own orders. */
export const GET = publicRoute(async (_req, { user }) => {
  if (!user) throw unauthorized();
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true, createdAt: true, total: true, status: true, items: { select: { productName: true, quantity: true } } },
  });
  return NextResponse.json({ orders });
});
