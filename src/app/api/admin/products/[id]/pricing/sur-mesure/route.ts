import { NextResponse } from "next/server";
import { surMesureSchema } from "@/lib/admin-validation";
import { adminRoute, parseJson } from "@/server/http";
import { updateSurMesure } from "@/server/services/product-pricing";

/** Sur Mesure parameters: enable, reference measure, stable price, price per 10 cm, limits. */
export const PUT = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const input = await parseJson(req, surMesureSchema);
  await updateSurMesure(params.id, input, user.id);
  return NextResponse.json({ ok: true });
});
