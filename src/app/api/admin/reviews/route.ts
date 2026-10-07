import { NextResponse } from "next/server";
import { z } from "zod";
import { adminReviewSchema } from "@/lib/admin-validation";
import { prisma } from "@/server/db";
import { adminRoute, parseJson } from "@/server/http";
import { listReviews } from "@/server/services/admin-queries";
import { audit } from "@/server/services/audit";

const schema = z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED", "HIDDEN"]).optional(), page: z.coerce.number().int().min(1).optional() });

export const GET = adminRoute(async (req) => NextResponse.json(await listReviews(schema.parse(Object.fromEntries(req.nextUrl.searchParams)))));

/** Transcribe a real review received outside the site. The admin must confirm it is genuine. */
export const POST = adminRoute(async (req, { user }) => {
  const input = await parseJson(req, adminReviewSchema);
  const review = await prisma.review.create({
    data: {
      productId: input.productId || null,
      authorName: input.authorName,
      rating: input.rating,
      comment: input.comment,
      isFeatured: input.isFeatured,
      status: "APPROVED",
      source: "ADMIN",
      moderatedById: user.id,
      moderatedAt: new Date(),
    },
  });
  await audit({ actorId: user.id, action: "review.create", entityType: "Review", entityId: review.id });
  return NextResponse.json({ id: review.id }, { status: 201 });
});
