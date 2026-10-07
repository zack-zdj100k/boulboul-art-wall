import { NextResponse } from "next/server";
import { deliveryRuleSchema } from "@/lib/admin-validation";
import { prisma } from "@/server/db";
import { adminRoute, parseJson } from "@/server/http";
import { saveDeliveryRule } from "@/server/services/catalog-admin";

export const GET = adminRoute(async () => NextResponse.json({ items: await prisma.deliveryRule.findMany({ orderBy: [{ wilayaCode: "asc" }, { commune: "asc" }] }) }));

export const POST = adminRoute(async (req, { user }) => {
  const input = await parseJson(req, deliveryRuleSchema);
  return NextResponse.json({ item: await saveDeliveryRule(null, input, user.id) }, { status: 201 });
});
