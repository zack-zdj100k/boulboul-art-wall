import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute } from "@/server/http";
import { searchOrders } from "@/server/services/admin-queries";

const schema = z.object({
  q: z.string().max(100).optional(),
  status: z.enum(["PENDING", "CONTACTING", "CONFIRMED", "DELIVERED", "CANCELLED"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export const GET = adminRoute(async (req) => {
  const query = schema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return NextResponse.json(await searchOrders(query));
});
