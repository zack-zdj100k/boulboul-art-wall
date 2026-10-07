import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute } from "@/server/http";
import { listCustomers } from "@/server/services/admin-queries";

const schema = z.object({ q: z.string().max(100).optional(), page: z.coerce.number().int().min(1).optional() });

export const GET = adminRoute(async (req) => NextResponse.json(await listCustomers(schema.parse(Object.fromEntries(req.nextUrl.searchParams)))));
