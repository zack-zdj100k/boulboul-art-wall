import { NextResponse } from "next/server";
import { categoryAdminSchema } from "@/lib/admin-validation";
import { prisma } from "@/server/db";
import { adminRoute, parseJson } from "@/server/http";
import { saveCategory } from "@/server/services/catalog-admin";

export const GET = adminRoute(async () => NextResponse.json({ items: await prisma.category.findMany({ orderBy: { sortOrder: "asc" } }) }));

export const POST = adminRoute(async (req, { user }) => {
  const input = await parseJson(req, categoryAdminSchema);
  return NextResponse.json({ item: await saveCategory(null, input, user.id) }, { status: 201 });
});
