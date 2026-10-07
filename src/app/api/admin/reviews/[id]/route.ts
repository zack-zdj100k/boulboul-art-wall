import { NextResponse } from "next/server";
import { reviewModerationSchema } from "@/lib/admin-validation";
import { prisma } from "@/server/db";
import { adminRoute, parseJson } from "@/server/http";
import { audit } from "@/server/services/audit";
import { moderateReview } from "@/server/services/review";

export const PATCH = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const input = await parseJson(req, reviewModerationSchema);
  const review = await moderateReview(params.id, input, user.id);
  return NextResponse.json({ status: review.status, isFeatured: review.isFeatured });
});

export const DELETE = adminRoute<{ id: string }>(async (_req, { params, user }) => {
  await prisma.review.delete({ where: { id: params.id } });
  await audit({ actorId: user.id, action: "review.delete", entityType: "Review", entityId: params.id });
  return NextResponse.json({ deleted: true });
});
