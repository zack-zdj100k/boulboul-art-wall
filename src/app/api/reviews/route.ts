import { NextResponse } from "next/server";
import { reviewSchema } from "@/lib/validation";
import { badRequest, parseJson, publicRoute, unauthorized } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { listProductReviews, submitReview } from "@/server/services/review";

export const GET = publicRoute(async (req) => {
  const productId = req.nextUrl.searchParams.get("productId");
  if (!productId) throw badRequest("validation.required");
  return NextResponse.json({ reviews: await listProductReviews(productId) });
});

export const POST = publicRoute(async (req, { user }) => {
  if (!user) throw unauthorized();
  rateLimit(`review:${user.id}`, 5, 60 * 60_000);
  const input = await parseJson(req, reviewSchema);
  const review = await submitReview(input, user);
  return NextResponse.json({ id: review.id, status: review.status }, { status: 201 });
});
