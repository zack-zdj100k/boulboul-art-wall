import { NextResponse } from "next/server";
import { measureBulkSchema } from "@/shared/lib/admin-validation";
import { adminRoute, parseJson } from "@/backend/http";
import { loadProductPricing } from "@/backend/services/product-form";
import { saveMeasures } from "@/backend/services/product-pricing";

export const GET = adminRoute<{ id: string }>(async (_req, { params }) => NextResponse.json(await loadProductPricing(params.id)));

/** Create or update measures (one row, or many from the grid generator). */
export const POST = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const { rows } = await parseJson(req, measureBulkSchema);
  const saved = await saveMeasures(params.id, rows, user.id);
  return NextResponse.json({ saved: saved.length });
});
