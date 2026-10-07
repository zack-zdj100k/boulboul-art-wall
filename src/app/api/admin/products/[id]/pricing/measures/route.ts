import { NextResponse } from "next/server";
import { measureBulkSchema } from "@/lib/admin-validation";
import { adminRoute, parseJson } from "@/server/http";
import { loadProductPricing } from "@/server/services/product-form";
import { saveMeasures } from "@/server/services/product-pricing";

export const GET = adminRoute<{ id: string }>(async (_req, { params }) => NextResponse.json(await loadProductPricing(params.id)));

/** Create or update measures (one row, or many from the grid generator). */
export const POST = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const { rows } = await parseJson(req, measureBulkSchema);
  const saved = await saveMeasures(params.id, rows, user.id);
  return NextResponse.json({ saved: saved.length });
});
