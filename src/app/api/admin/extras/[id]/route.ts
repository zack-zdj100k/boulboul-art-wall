import { NextResponse } from "next/server";
import { extraAdminSchema } from "@/lib/admin-validation";
import { adminRoute, parseJson } from "@/server/http";
import { saveExtra, deleteExtra } from "@/server/services/catalog-admin";

export const PUT = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const input = await parseJson(req, extraAdminSchema);
  return NextResponse.json({ item: await saveExtra(params.id, input, user.id) });
});

export const DELETE = adminRoute<{ id: string }>(async (_req, { params, user }) => {
  await deleteExtra(params.id, user.id);
  return NextResponse.json({ deleted: true });
});
