import { NextResponse } from "next/server";
import { returnStatusSchema } from "@/lib/admin-validation";
import { adminRoute, parseJson } from "@/server/http";
import { deleteReturnRequest, updateReturnStatus } from "@/server/services/returns";

export const PATCH = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const input = await parseJson(req, returnStatusSchema);
  return NextResponse.json({ request: await updateReturnStatus(params.id, input, user) });
});

export const DELETE = adminRoute<{ id: string }>(async (_req, { params, user }) => {
  await deleteReturnRequest(params.id, user.id);
  return NextResponse.json({ deleted: true });
});
