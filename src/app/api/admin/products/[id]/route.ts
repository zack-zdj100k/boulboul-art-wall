import { NextResponse } from "next/server";
import { productAdminSchema } from "@/lib/admin-validation";
import { prisma } from "@/server/db";
import { adminRoute, notFound, parseJson } from "@/server/http";
import { archiveProduct, deleteProductPermanently, updateProduct } from "@/server/services/product-admin";

export const GET = adminRoute<{ id: string }>(async (_req, { params }) => {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: { images: { include: { media: true }, orderBy: { sortOrder: "asc" } }, measures: true, frames: true, extras: true },
  });
  if (!product) throw notFound();
  return NextResponse.json({ product });
});

export const PUT = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const input = await parseJson(req, productAdminSchema);
  const product = await updateProduct(params.id, input, user.id);
  return NextResponse.json({ id: product.id, slug: product.slug });
});

/** Archives by default; `?permanent=1` deletes the product (orders keep their snapshots). */
export const DELETE = adminRoute<{ id: string }>(async (req, { params, user }) => {
  if (req.nextUrl.searchParams.get("permanent") === "1") {
    await deleteProductPermanently(params.id, user.id);
    return NextResponse.json({ deleted: true });
  }
  await archiveProduct(params.id, user.id);
  return NextResponse.json({ archived: true });
});
