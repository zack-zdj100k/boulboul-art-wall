import { NextResponse } from "next/server";
import { reviewModerationSchema } from "@/shared/lib/admin-validation";
import { prisma } from "@/backend/db";
import { adminRoute, parseJson } from "@/backend/http";
import { audit } from "@/backend/services/audit";
import { moderateReview } from "@/backend/services/review";

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
