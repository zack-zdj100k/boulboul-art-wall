import { NextResponse } from "next/server";
import { frameAdminSchema } from "@/shared/lib/admin-validation";
import { adminRoute, parseJson } from "@/backend/http";
import { saveFrame, deleteFrame } from "@/backend/services/catalog-admin";

export const PUT = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const input = await parseJson(req, frameAdminSchema);
  return NextResponse.json({ item: await saveFrame(params.id, input, user.id) });
});

export const DELETE = adminRoute<{ id: string }>(async (_req, { params, user }) => {
  await deleteFrame(params.id, user.id);
  return NextResponse.json({ deleted: true });
});
