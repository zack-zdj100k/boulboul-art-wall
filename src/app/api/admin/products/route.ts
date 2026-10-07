import { NextResponse } from "next/server";
import { productAdminSchema } from "@/lib/admin-validation";
import { prisma } from "@/server/db";
import { adminRoute, parseJson } from "@/server/http";
import { createProduct } from "@/server/services/product-admin";

export const GET = adminRoute(async () => {
  const products = await prisma.product.findMany({
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
    select: { id: true, slug: true, name: true, status: true, isFeatured: true, isDemo: true, category: { select: { name: true } } },
  });
  return NextResponse.json({ products });
});

export const POST = adminRoute(async (req, { user }) => {
  const input = await parseJson(req, productAdminSchema);
  const product = await createProduct(input, user.id);
  return NextResponse.json({ id: product.id, slug: product.slug }, { status: 201 });
});
