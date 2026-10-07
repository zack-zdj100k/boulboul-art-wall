import { NextResponse } from "next/server";
import { categoryAdminSchema } from "@/shared/lib/admin-validation";
import { prisma } from "@/backend/db";
import { adminRoute, parseJson } from "@/backend/http";
import { saveCategory } from "@/backend/services/catalog-admin";

export const GET = adminRoute(async () => NextResponse.json({ items: await prisma.category.findMany({ orderBy: { sortOrder: "asc" } }) }));

export const POST = adminRoute(async (req, { user }) => {
  const input = await parseJson(req, categoryAdminSchema);
  return NextResponse.json({ item: await saveCategory(null, input, user.id) }, { status: 201 });
});
