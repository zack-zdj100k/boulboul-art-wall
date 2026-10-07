import "server-only";
import type { ReviewStatus } from "@/backend/generated/prisma/client";
import { pick, type Locale } from "@/shared/i18n/config";
import { prisma } from "@/backend/db";
import { AppError } from "@/backend/http";
import { audit } from "./audit";

// ReviewService — only APPROVED reviews are ever shown publicly. No review is ever generated.

const LINK_RE = /(https?:\/\/|www\.)/i;

export async function submitReview(input: { productId: string; rating: number; comment: string }, user: { id: string; fullName: string }) {
  const product = await prisma.product.findFirst({ where: { id: input.productId, status: "ACTIVE" }, select: { id: true } });
  if (!product) throw new AppError(404, "errors.productUnavailable");

  const existing = await prisma.review.findFirst({ where: { productId: input.productId, userId: user.id } });
  if (existing) throw new AppError(409, "reviews.already");

  // Basic anti-abuse: no more than 5 reviews per account per day; links go to moderation anyway.
  const recent = await prisma.review.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
  if (recent >= 5) throw new AppError(429, "errors.rateLimited");

  const verifiedPurchase =
    (await prisma.orderItem.count({
      where: { productId: input.productId, order: { userId: user.id, status: { in: ["CONFIRMED", "DELIVERED"] } } },
    })) > 0;

  return prisma.review.create({
    data: {
      productId: input.productId,
      userId: user.id,
      authorName: user.fullName,
      rating: input.rating,
      comment: input.comment,
      verifiedPurchase,
      status: "PENDING",
      source: "CUSTOMER",
    },
    select: { id: true, status: true, comment: true },
  }).then((r) => ({ ...r, flagged: LINK_RE.test(r.comment) }));
}

export async function moderateReview(id: string, data: { status?: ReviewStatus; isFeatured?: boolean }, actorId: string) {
  const review = await prisma.review.update({
    where: { id },
    data: { ...data, moderatedById: actorId, moderatedAt: new Date() },
  });
  await audit({ actorId, action: "review.moderate", entityType: "Review", entityId: id, metadata: data });
  return review;
}

export async function listProductReviews(productId: string) {
  return prisma.review.findMany({
    where: { productId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, authorName: true, rating: true, comment: true, createdAt: true, verifiedPurchase: true },
  });
}

/** Testimonials for the home page: approved + featured reviews only. */
export async function listTestimonials(locale: Locale) {
  const rows = await prisma.review.findMany({
    where: { status: "APPROVED", isFeatured: true },
    orderBy: { createdAt: "desc" },
    take: 18,
    include: { product: { select: { name: true, nameAr: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    rating: r.rating,
    comment: r.comment,
    product: r.product ? pick(r.product, "name", locale) : null,
  }));
}
