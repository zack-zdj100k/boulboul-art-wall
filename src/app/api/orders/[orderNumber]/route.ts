import { NextResponse } from "next/server";
import { canAccessOrder } from "@/server/auth/order-access";
import { prisma } from "@/server/db";
import { notFound, publicRoute } from "@/server/http";

// Owner (signed in) or holder of the order's private token. Anyone else gets a 404.
export const GET = publicRoute<{ orderNumber: string }>(async (req, { params, user }) => {
  const order = await prisma.order.findUnique({
    where: { orderNumber: params.orderNumber },
    select: {
      orderNumber: true, publicToken: true, userId: true, status: true, createdAt: true, customerName: true,
      wilayaName: true, commune: true, address: true, subtotal: true, negotiatedDiscount: true, deliveryFee: true, total: true,
      items: { select: { productName: true, widthCm: true, heightCm: true, frameName: true, extras: true, quantity: true, unitPrice: true, totalPrice: true } },
    },
  });
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const allowed = order && canAccessOrder(order, user, token);
  if (!order || !allowed) throw notFound("order.notFound");
  const { publicToken: _t, userId: _u, ...safe } = order;
  return NextResponse.json({ order: safe });
});
