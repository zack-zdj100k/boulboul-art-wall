import { NextResponse } from "next/server";
import { extraAdminSchema } from "@/lib/admin-validation";
import { prisma } from "@/server/db";
import { adminRoute, parseJson } from "@/server/http";
import { saveExtra } from "@/server/services/catalog-admin";

export const GET = adminRoute(async () => NextResponse.json({ items: await prisma.extraOption.findMany({ orderBy: { sortOrder: "asc" } }) }));

export const POST = adminRoute(async (req, { user }) => {
  const input = await parseJson(req, extraAdminSchema);
  return NextResponse.json({ item: await saveExtra(null, input, user.id) }, { status: 201 });
});
