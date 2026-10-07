import { NextResponse } from "next/server";
import { adminReturnSchema } from "@/shared/lib/admin-validation";
import { adminRoute, parseJson } from "@/backend/http";
import { RETURN_REASONS } from "@/shared/lib/returns";
import { createReturnRequest } from "@/backend/services/returns";

/** A manager records a return / exchange the customer asked for by phone or message. */
export const POST = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const input = await parseJson(req, adminReturnSchema);
  const request = await createReturnRequest(params.id, { ...input, reason: RETURN_REASONS[input.reason] }, { source: "ADMIN", actorId: user.id });
  return NextResponse.json({ id: request.id }, { status: 201 });
});
