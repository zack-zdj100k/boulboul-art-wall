import { NextResponse } from "next/server";
import { orderStatusSchema } from "@/lib/admin-validation";
import { prisma } from "@/server/db";
import { adminRoute, notFound, parseJson } from "@/server/http";
import { deleteOrder, updateOrderStatus } from "@/server/services/order";

export const GET = adminRoute<{ id: string }>(async (_req, { params }) => {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: true, adjustments: { orderBy: { createdAt: "asc" } }, returns: true, history: { include: { changedBy: { select: { fullName: true } } }, orderBy: { createdAt: "asc" } }, emails: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) throw notFound();
  return NextResponse.json({ order });
});

/** Status change. PENDING/CONTACTING → CONFIRMED triggers the customer confirmation email (server-side). */
export const PATCH = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const { status, note } = await parseJson(req, orderStatusSchema);
  const result = await updateOrderStatus(params.id, status, user, note);
  return NextResponse.json({ status: result.order.status, from: result.from, email: result.email });
});

export const DELETE = adminRoute<{ id: string }>(async (_req, { params, user }) => {
  await deleteOrder(params.id, user.id);
  return NextResponse.json({ deleted: true });
});
