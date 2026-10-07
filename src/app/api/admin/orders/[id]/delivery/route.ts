import { NextResponse } from "next/server";
import { deliveryFeeSchema } from "@/shared/lib/admin-validation";
import { adminRoute, parseJson } from "@/backend/http";
import { setOrderDeliveryFee } from "@/backend/services/order";

export const POST = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const input = await parseJson(req, deliveryFeeSchema);
  return NextResponse.json({ totals: await setOrderDeliveryFee(params.id, input, user) });
});
