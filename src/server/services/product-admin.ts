import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ProductAdminInput } from "@/lib/admin-validation";
import { slugify } from "@/lib/utils";
import { prisma } from "@/server/db";
import { AppError } from "@/server/http";
import { audit } from "./audit";

async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "creation";
  let slug = root;
  for (let i = 2; await prisma.product.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } }); i++) {
    slug = `${root}-${i}`;
  }
  return slug;
}

function scalarData(input: ProductAdminInput) {
  const { images: _i, frames: _f, extras: _e, slug: _slug, ...rest } = input;
  return {
    ...rest,
    categoryId: rest.categoryId || null,
    promoValue: rest.promoType ? rest.promoValue : null,
    archivedAt: rest.status === "ARCHIVED" ? new Date() : null,
  } satisfies Omit<Prisma.ProductUncheckedCreateInput, "slug">;
}

function nested(input: ProductAdminInput) {
  return {
    images: { create: input.images.map((img, i) => ({ mediaId: img.mediaId, alt: img.alt ?? null, sortOrder: i })) },
    frames: { create: input.frames.map((f) => ({ frameId: f.frameId, priceOverride: f.priceOverride, isDefault: f.isDefault })) },
    extras: { create: input.extras.map((e) => ({ extraId: e.extraId, priceOverride: e.priceOverride })) },
  };
}

async function assertReferences(input: ProductAdminInput) {
  const mediaIds = [...new Set(input.images.map((i) => i.mediaId))];
  if (mediaIds.length && (await prisma.media.count({ where: { id: { in: mediaIds }, visibility: "PUBLIC" } })) !== mediaIds.length) {
    throw new AppError(400, "admin.invalidMedia");
  }
  const frameIds = [...new Set(input.frames.map((f) => f.frameId))];
  if (frameIds.length !== input.frames.length || (frameIds.length && (await prisma.frameOption.count({ where: { id: { in: frameIds } } })) !== frameIds.length)) {
    throw new AppError(400, "admin.invalidFrame");
  }
  const extraIds = [...new Set(input.extras.map((e) => e.extraId))];
  if (extraIds.length !== input.extras.length || (extraIds.length && (await prisma.extraOption.count({ where: { id: { in: extraIds } } })) !== extraIds.length)) {
    throw new AppError(400, "admin.invalidExtra");
  }
}

export async function createProduct(input: ProductAdminInput, actorId: string) {
  await assertReferences(input);
  const slug = await uniqueSlug(input.slug || input.name);
  const product = await prisma.product.create({ data: { slug, ...scalarData(input), ...nested(input) } });
  await audit({ actorId, action: "product.create", entityType: "Product", entityId: product.id, metadata: { name: product.name } });
  return product;
}

export async function updateProduct(id: string, input: ProductAdminInput, actorId: string) {
  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true, slug: true, status: true } });
  if (!existing) throw new AppError(404, "errors.notFound");
  await assertReferences(input);
  const slug = input.slug && input.slug !== existing.slug ? await uniqueSlug(input.slug, id) : existing.slug;

  // Nested option lists are replaced wholesale. Price tables have their own endpoints
  // (product-pricing.ts). Orders keep their own snapshots, so this never alters historical orders.
  const product = await prisma.$transaction(async (tx) => {
    await tx.productImage.deleteMany({ where: { productId: id } });
    await tx.productFrame.deleteMany({ where: { productId: id } });
    await tx.productExtra.deleteMany({ where: { productId: id } });
    return tx.product.update({ where: { id }, data: { slug, ...scalarData(input), ...nested(input) } });
  });
  await audit({
    actorId,
    action: input.status === "ARCHIVED" && existing.status !== "ARCHIVED" ? "product.archive" : "product.update",
    entityType: "Product",
    entityId: id,
    metadata: { name: product.name },
  });
  return product;
}

export async function archiveProduct(id: string, actorId: string) {
  const product = await prisma.product.update({ where: { id }, data: { status: "ARCHIVED", archivedAt: new Date(), isFeatured: false } });
  await audit({ actorId, action: "product.archive", entityType: "Product", entityId: id, metadata: { name: product.name } });
  return product;
}

/**
 * Permanently delete a product. Past orders are unaffected: each order item keeps its own
 * snapshot (name, size, frame, options, prices, image) and is simply unlinked from the product.
 * Its images stay in the media library; its reviews are removed with it.
 */
export async function deleteProductPermanently(id: string, actorId: string) {
  const existing = await prisma.product.findUnique({ where: { id }, select: { name: true, _count: { select: { orderItems: true } } } });
  if (!existing) throw new AppError(404, "errors.notFound");
  await prisma.product.delete({ where: { id } });
  await audit({ actorId, action: "product.delete", entityType: "Product", entityId: id, metadata: { name: existing.name, orderedTimes: existing._count.orderItems } });
}
