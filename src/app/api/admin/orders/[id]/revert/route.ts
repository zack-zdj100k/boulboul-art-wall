import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, parseJson } from "@/server/http";
import { revertOrderStatus } from "@/server/services/order";

/** Go back to the previous status (mistake). Never re-sends the confirmation email. */
export const POST = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const { note } = await parseJson(req, z.object({ note: z.string().trim().max(500).optional() }));
  const result = await revertOrderStatus(params.id, user, note);
  return NextResponse.json({ status: result.order.status, from: result.from });
});
