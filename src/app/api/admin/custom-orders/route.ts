import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute } from "@/backend/http";
import { listCustomOrders } from "@/backend/services/admin-queries";

const schema = z.object({
  q: z.string().max(100).optional(),
  status: z.enum(["PENDING", "REVIEWING", "CONTACTED", "APPROVED", "REJECTED", "DELIVERED", "COMPLETED"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export const GET = adminRoute(async (req) => NextResponse.json(await listCustomOrders(schema.parse(Object.fromEntries(req.nextUrl.searchParams)))));
