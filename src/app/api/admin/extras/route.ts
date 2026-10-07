import { NextResponse } from "next/server";
import { extraAdminSchema } from "@/shared/lib/admin-validation";
import { prisma } from "@/backend/db";
import { adminRoute, parseJson } from "@/backend/http";
import { saveExtra } from "@/backend/services/catalog-admin";

export const GET = adminRoute(async () => NextResponse.json({ items: await prisma.extraOption.findMany({ orderBy: { sortOrder: "asc" } }) }));

export const POST = adminRoute(async (req, { user }) => {
  const input = await parseJson(req, extraAdminSchema);
  return NextResponse.json({ item: await saveExtra(null, input, user.id) }, { status: 201 });
});
