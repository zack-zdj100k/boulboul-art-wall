import { NextResponse } from "next/server";
import { deliveryRuleSchema } from "@/shared/lib/admin-validation";
import { adminRoute, parseJson } from "@/backend/http";
import { saveDeliveryRule, deleteDeliveryRule } from "@/backend/services/catalog-admin";

export const PUT = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const input = await parseJson(req, deliveryRuleSchema);
  return NextResponse.json({ item: await saveDeliveryRule(params.id, input, user.id) });
});

export const DELETE = adminRoute<{ id: string }>(async (_req, { params, user }) => {
  await deleteDeliveryRule(params.id, user.id);
  return NextResponse.json({ deleted: true });
});
