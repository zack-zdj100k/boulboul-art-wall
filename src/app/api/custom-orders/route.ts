import { NextResponse } from "next/server";
import { customOrderSchema } from "@/shared/lib/validation";
import { prisma } from "@/backend/db";
import { clientIp, parseJson, publicRoute, unauthorized } from "@/backend/http";
import { rateLimit } from "@/backend/rate-limit";
import { createCustomOrder } from "@/backend/services/custom-order";

export const POST = publicRoute(async (req, { user }) => {
  rateLimit(`custom:${clientIp(req)}`, 6, 15 * 60_000);
  const input = await parseJson(req, customOrderSchema);
  const order = await createCustomOrder(input, user?.id ?? null);
  return NextResponse.json({ reference: order.reference, status: order.status }, { status: 201 });
});

export const GET = publicRoute(async (_req, { user }) => {
  if (!user) throw unauthorized();
  const requests = await prisma.customOrder.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { reference: true, createdAt: true, status: true, description: true, widthCm: true, heightCm: true },
  });
  return NextResponse.json({ requests });
});
