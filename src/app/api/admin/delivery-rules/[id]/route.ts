import { NextResponse } from "next/server";
import { deliveryRuleSchema } from "@/lib/admin-validation";
import { adminRoute, parseJson } from "@/server/http";
import { saveDeliveryRule, deleteDeliveryRule } from "@/server/services/catalog-admin";

export const PUT = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const input = await parseJson(req, deliveryRuleSchema);
  return NextResponse.json({ item: await saveDeliveryRule(params.id, input, user.id) });
});

export const DELETE = adminRoute<{ id: string }>(async (_req, { params, user }) => {
  await deleteDeliveryRule(params.id, user.id);
  return NextResponse.json({ deleted: true });
});
