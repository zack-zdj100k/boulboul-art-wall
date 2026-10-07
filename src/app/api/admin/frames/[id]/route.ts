import { NextResponse } from "next/server";
import { frameAdminSchema } from "@/lib/admin-validation";
import { adminRoute, parseJson } from "@/server/http";
import { saveFrame, deleteFrame } from "@/server/services/catalog-admin";

export const PUT = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const input = await parseJson(req, frameAdminSchema);
  return NextResponse.json({ item: await saveFrame(params.id, input, user.id) });
});

export const DELETE = adminRoute<{ id: string }>(async (_req, { params, user }) => {
  await deleteFrame(params.id, user.id);
  return NextResponse.json({ deleted: true });
});
