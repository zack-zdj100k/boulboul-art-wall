import { NextResponse } from "next/server";
import { measurePatchSchema } from "@/shared/lib/admin-validation";
import { adminRoute, parseJson } from "@/backend/http";
import { deleteMeasure, updateMeasure } from "@/backend/services/product-pricing";

export const PATCH = adminRoute<{ id: string; rowId: string }>(async (req, { params, user }) => {
  const data = await parseJson(req, measurePatchSchema);
  return NextResponse.json({ row: await updateMeasure(params.id, params.rowId, data, user.id) });
});

export const DELETE = adminRoute<{ id: string; rowId: string }>(async (_req, { params, user }) => {
  await deleteMeasure(params.id, params.rowId, user.id);
  return NextResponse.json({ deleted: true });
});
