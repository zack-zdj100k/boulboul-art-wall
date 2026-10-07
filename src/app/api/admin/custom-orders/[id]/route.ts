import { NextResponse } from "next/server";
import { customOrderAdminSchema } from "@/shared/lib/admin-validation";
import { adminRoute, parseJson } from "@/backend/http";
import { deleteCustomOrder, updateCustomOrder } from "@/backend/services/custom-order";

export const PATCH = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const input = await parseJson(req, customOrderAdminSchema);
  const updated = await updateCustomOrder(params.id, input, user.id);
  return NextResponse.json({ status: updated.status, adminNotes: updated.adminNotes, price: updated.price, total: updated.total });
});

export const DELETE = adminRoute<{ id: string }>(async (_req, { params, user }) => {
  await deleteCustomOrder(params.id, user.id);
  return NextResponse.json({ deleted: true });
});
