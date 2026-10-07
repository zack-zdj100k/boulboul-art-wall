import { NextResponse } from "next/server";
import { categoryAdminSchema } from "@/lib/admin-validation";
import { adminRoute, parseJson } from "@/server/http";
import { saveCategory, deleteCategory } from "@/server/services/catalog-admin";

export const PUT = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const input = await parseJson(req, categoryAdminSchema);
  return NextResponse.json({ item: await saveCategory(params.id, input, user.id) });
});

export const DELETE = adminRoute<{ id: string }>(async (_req, { params, user }) => {
  await deleteCategory(params.id, user.id);
  return NextResponse.json({ deleted: true });
});
