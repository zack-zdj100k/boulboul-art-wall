import { NextResponse } from "next/server";
import { managerNotesSchema } from "@/lib/admin-validation";
import { adminRoute, parseJson } from "@/server/http";
import { updateManagerNotes } from "@/server/services/order";

export const PUT = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const { managerNotes } = await parseJson(req, managerNotesSchema);
  await updateManagerNotes(params.id, managerNotes ?? null, user);
  return NextResponse.json({ ok: true });
});
