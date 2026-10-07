import "server-only";
import { Prisma } from "@/backend/generated/prisma/client";
import type { SurMesureInput } from "@/shared/lib/admin-validation";
import { prisma } from "@/backend/db";
import { AppError } from "@/backend/http";
import { audit } from "./audit";

// ProductPricingService — the admin-managed pricing of one product:
//  • measures created by the admin, each with its exact price (any dimensions);
//  • Sur Mesure parameters (reference measure, stable price, price per 10 cm).
// Editing them never changes existing orders (they keep their own price snapshot).

type MeasureRow = { widthCm: number; heightCm: number; price: number; isActive: boolean; label?: string | null; description?: string | null };

async function assertProduct(productId: string) {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!p) throw new AppError(404, "errors.notFound");
}

function duplicate(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new AppError(409, "pricing.duplicateDimension");
  throw err;
}

/** Create or update measures (one, or many from the grid generator). Each row carries its own typed price. */
export async function saveMeasures(productId: string, rows: MeasureRow[], actorId: string) {
  await assertProduct(productId);
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.widthCm}x${r.heightCm}`;
    if (seen.has(key)) throw new AppError(400, "pricing.duplicateDimension");
    seen.add(key);
  }
  const result = await prisma.$transaction(
    rows.map((r) => {
      const data = { price: r.price, isActive: r.isActive, ...(r.label !== undefined ? { label: r.label || null } : {}), ...(r.description !== undefined ? { description: r.description || null } : {}) };
      return prisma.productMeasure.upsert({
        where: { productId_widthCm_heightCm: { productId, widthCm: r.widthCm, heightCm: r.heightCm } },
        create: { productId, widthCm: r.widthCm, heightCm: r.heightCm, ...data },
        update: data,
      });
    }),
  );
  await audit({ actorId, action: "pricing.measures.save", entityType: "Product", entityId: productId, metadata: { count: rows.length } });
  return result;
}

export async function updateMeasure(productId: string, rowId: string, data: Partial<MeasureRow>, actorId: string) {
  const row = await prisma.productMeasure.findFirst({ where: { id: rowId, productId } });
  if (!row) throw new AppError(404, "errors.notFound");
  const updated = await prisma.productMeasure
    .update({ where: { id: rowId }, data: { ...data, ...(data.label !== undefined ? { label: data.label || null } : {}), ...(data.description !== undefined ? { description: data.description || null } : {}) } })
    .catch(duplicate);
  await audit({
    actorId,
    action: "pricing.measure.update",
    entityType: "Product",
    entityId: productId,
    metadata: { size: `${updated.widthCm}x${updated.heightCm}`, price: { from: row.price, to: updated.price }, isActive: updated.isActive },
  });
  return updated;
}

export async function deleteMeasure(productId: string, rowId: string, actorId: string) {
  const row = await prisma.productMeasure.findFirst({ where: { id: rowId, productId } });
  if (!row) throw new AppError(404, "errors.notFound");
  await prisma.productMeasure.delete({ where: { id: rowId } });
  await audit({ actorId, action: "pricing.measure.delete", entityType: "Product", entityId: productId, metadata: { size: `${row.widthCm}x${row.heightCm}`, price: row.price } });
}

/** Sur Mesure parameters of a product (enable + stable reference + price per 10 cm + optional limits). */
export async function updateSurMesure(productId: string, input: SurMesureInput, actorId: string) {
  await assertProduct(productId);
  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      allowCustomSize: input.enabled,
      refWidthCm: input.refWidthCm,
      refHeightCm: input.refHeightCm,
      refPrice: input.refPrice,
      widthStepPrice: input.widthStepPrice,
      heightStepPrice: input.heightStepPrice,
      customMinWidthCm: input.minWidthCm,
      customMaxWidthCm: input.maxWidthCm,
      customMinHeightCm: input.minHeightCm,
      customMaxHeightCm: input.maxHeightCm,
      customMinPrice: input.minPrice,
    },
  });
  await audit({ actorId, action: "pricing.surMesure.update", entityType: "Product", entityId: productId, metadata: input });
  return product;
}
