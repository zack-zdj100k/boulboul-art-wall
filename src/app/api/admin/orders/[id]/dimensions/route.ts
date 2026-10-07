import { NextResponse } from "next/server";
import { dimensionChangeSchema } from "@/lib/admin-validation";
import { adminRoute, parseJson } from "@/server/http";
import { changeOrderDimensions, previewDimensionChange } from "@/server/services/order";

/** Preview: ?itemId=&widthCm=&heightCm= — same pricing engine, nothing saved. */
export const GET = adminRoute<{ id: string }>(async (req, { params }) => {
  const q = req.nextUrl.searchParams;
  const input = dimensionChangeSchema.parse({ itemId: q.get("itemId"), widthCm: q.get("widthCm"), heightCm: q.get("heightCm") });
  return NextResponse.json(await previewDimensionChange(params.id, input.itemId, input.widthCm, input.heightCm));
});

export const POST = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const input = await parseJson(req, dimensionChangeSchema);
  return NextResponse.json({ totals: await changeOrderDimensions(params.id, input, user) });
});
