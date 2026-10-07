import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, parseJson } from "@/backend/http";
import { retryOrderEmail } from "@/backend/services/order";

export const POST = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const { type } = await parseJson(req, z.object({ type: z.enum(["NEW_ORDER_ADMIN", "ORDER_CONFIRMED_CUSTOMER", "ORDER_DELIVERED_CUSTOMER"]) }));
  return NextResponse.json(await retryOrderEmail(params.id, type, user.id));
});
