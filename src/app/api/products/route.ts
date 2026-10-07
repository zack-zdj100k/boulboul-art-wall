import { NextResponse } from "next/server";
import { z } from "zod";
import { getLocale } from "@/shared/i18n/server";
import { publicRoute } from "@/backend/http";
import { listCatalog } from "@/backend/services/product";

const querySchema = z.object({
  q: z.string().max(80).optional(),
  category: z.string().max(80).optional(),
  min: z.coerce.number().int().min(0).optional(),
  max: z.coerce.number().int().min(0).optional(),
  sort: z.enum(["featured", "newest", "priceAsc", "priceDesc"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(48).optional(),
});

export const GET = publicRoute(async (req) => {
  const query = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const result = await listCatalog(query, await getLocale());
  return NextResponse.json(result);
});
