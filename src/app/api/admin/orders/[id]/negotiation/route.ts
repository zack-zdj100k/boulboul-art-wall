import { NextResponse } from "next/server";
import { negotiationSchema } from "@/lib/admin-validation";
import { adminRoute, parseJson } from "@/server/http";
import { negotiateOrder } from "@/server/services/order";

/** Set the negotiated discount of this order (recorded in its negotiation history). */
export const POST = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const input = await parseJson(req, negotiationSchema);
  return NextResponse.json({ totals: await negotiateOrder(params.id, input, user) });
});
