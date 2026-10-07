import "server-only";
import type { z } from "zod";
import type { categoryAdminSchema, deliveryRuleSchema, extraAdminSchema, frameAdminSchema } from "@/lib/admin-validation";
import { getWilaya } from "@/lib/algeria";
import { slugify } from "@/lib/utils";
import { prisma } from "@/server/db";
import { AppError } from "@/server/http";
import { audit } from "./audit";

// Admin CRUD for categories, frames, extras and delivery rules.

type CategoryInput = z.infer<typeof categoryAdminSchema>;
type FrameInput = z.infer<typeof frameAdminSchema>;
type ExtraInput = z.infer<typeof extraAdminSchema>;
type DeliveryInput = z.infer<typeof deliveryRuleSchema>;

async function categorySlug(input: CategoryInput, excludeId?: string) {
  const slug = slugify(input.slug || input.name) || "collection";
  const clash = await prisma.category.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) } });
  if (clash) throw new AppError(409, "admin.slugTaken", { slug: "admin.slugTaken" });
  return slug;
}

export async function saveCategory(id: string | null, input: CategoryInput, actorId: string) {
  const slug = await categorySlug(input, id ?? undefined);
  const data = { ...input, slug, imageId: input.imageId || null };
  const row = id ? await prisma.category.update({ where: { id }, data }) : await prisma.category.create({ data });
  await audit({ actorId, action: id ? "category.update" : "category.create", entityType: "Category", entityId: row.id, metadata: { name: row.name } });
  return row;
}

export async function deleteCategory(id: string, actorId: string) {
  // Products keep existing (categoryId → null); orders are untouched.
  await prisma.category.delete({ where: { id } });
  await audit({ actorId, action: "category.delete", entityType: "Category", entityId: id });
}

export async function saveFrame(id: string | null, input: FrameInput, actorId: string) {
  const data = { ...input, imageId: input.imageId || null };
  const row = id ? await prisma.frameOption.update({ where: { id }, data }) : await prisma.frameOption.create({ data });
  await audit({ actorId, action: id ? "frame.update" : "frame.create", entityType: "FrameOption", entityId: row.id, metadata: { name: row.name, price: row.price } });
  return row;
}

export async function deleteFrame(id: string, actorId: string) {
  await prisma.frameOption.delete({ where: { id } });
  await audit({ actorId, action: "frame.delete", entityType: "FrameOption", entityId: id });
}

export async function saveExtra(id: string | null, input: ExtraInput, actorId: string) {
  const row = id ? await prisma.extraOption.update({ where: { id }, data: input }) : await prisma.extraOption.create({ data: input });
  await audit({ actorId, action: id ? "extra.update" : "extra.create", entityType: "ExtraOption", entityId: row.id, metadata: { name: row.name, price: row.price } });
  return row;
}

export async function deleteExtra(id: string, actorId: string) {
  await prisma.extraOption.delete({ where: { id } });
  await audit({ actorId, action: "extra.delete", entityType: "ExtraOption", entityId: id });
}

export async function saveDeliveryRule(id: string | null, input: DeliveryInput, actorId: string) {
  if (input.wilayaCode && !getWilaya(input.wilayaCode)) throw new AppError(400, "validation.wilaya", { wilayaCode: "validation.wilaya" });
  if (input.commune && !input.wilayaCode) throw new AppError(400, "admin.communeNeedsWilaya", { commune: "admin.communeNeedsWilaya" });
  const data = { ...input, wilayaCode: input.wilayaCode || null, commune: input.commune || null };
  const row = id ? await prisma.deliveryRule.update({ where: { id }, data }) : await prisma.deliveryRule.create({ data });
  await audit({ actorId, action: id ? "delivery.update" : "delivery.create", entityType: "DeliveryRule", entityId: row.id, metadata: { wilaya: row.wilayaCode, fee: row.fee } });
  return row;
}

export async function deleteDeliveryRule(id: string, actorId: string) {
  await prisma.deliveryRule.delete({ where: { id } });
  await audit({ actorId, action: "delivery.delete", entityType: "DeliveryRule", entityId: id });
}

/** Removes everything the development seed flagged as demo. Real data is never touched. */
export async function purgeDemoData(actorId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const orders = await tx.order.deleteMany({ where: { isDemo: true } });
    const demoProducts = await tx.product.findMany({ where: { isDemo: true }, select: { id: true } });
    const ordered = await tx.orderItem.findMany({ where: { productId: { in: demoProducts.map((p) => p.id) } }, select: { productId: true } });
    const keep = new Set(ordered.map((o) => o.productId));
    const removable = demoProducts.filter((p) => !keep.has(p.id)).map((p) => p.id);
    await tx.product.updateMany({ where: { id: { in: [...keep].filter(Boolean) as string[] } }, data: { status: "ARCHIVED", archivedAt: new Date() } });
    const products = await tx.product.deleteMany({ where: { id: { in: removable } } });
    const frames = await tx.frameOption.deleteMany({ where: { isDemo: true } });
    const extras = await tx.extraOption.deleteMany({ where: { isDemo: true } });
    const users = await tx.user.deleteMany({ where: { isDemo: true, role: "CUSTOMER" } });
    return { orders: orders.count, products: products.count, archived: keep.size, frames: frames.count, extras: extras.count, users: users.count };
  });
  await audit({ actorId, action: "demo.purge", entityType: "System", metadata: result });
  return result;
}
