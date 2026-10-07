import "server-only";
import { prisma } from "@/backend/db";
import { calculateSurMesurePrice, isValidDimension, surMesureFromProduct, type PriceLookup } from "@/shared/lib/pricing";

// PricingService (backend) — database lookups on top of the pure engine in src/shared/lib/pricing.ts.
// Used by the product page quote, order creation, admin order re-pricing and negotiation.

export * from "@/shared/lib/pricing";

export const surMesureSelect = {
  allowCustomSize: true,
  refWidthCm: true,
  refHeightCm: true,
  refPrice: true,
  widthStepPrice: true,
  heightStepPrice: true,
  customMinWidthCm: true,
  customMaxWidthCm: true,
  customMinHeightCm: true,
  customMaxHeightCm: true,
  customMinPrice: true,
} as const;

/** Active measure created by the admin for exact dimensions, or null. */
export async function getMeasurePrice(productId: string, widthCm: number, heightCm: number) {
  if (!isValidDimension(widthCm) || !isValidDimension(heightCm)) return null;
  return prisma.productMeasure.findFirst({ where: { productId, widthCm, heightCm, isActive: true, price: { gt: 0 } } });
}

/** Calculated Sur Mesure price (stable price ± per 10 cm), or null when not configured. */
export async function getSurMesurePrice(productId: string, widthCm: number, heightCm: number) {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: surMesureSelect });
  return p ? calculateSurMesurePrice(surMesureFromProduct(p), widthCm, heightCm) : null;
}

/** Official product price: a created measure first, then the Sur Mesure calculation; null = contact us. */
export async function getProductPrice(productId: string, widthCm: number, heightCm: number): Promise<PriceLookup | null> {
  const measure = await getMeasurePrice(productId, widthCm, heightCm);
  if (measure) return { source: "PRESET", refId: measure.id, price: measure.price, label: measure.label, surMesure: null };
  const calc = await getSurMesurePrice(productId, widthCm, heightCm);
  if (calc) return { source: "SUR_MESURE", refId: null, price: calc.price, label: null, surMesure: calc.detail };
  return null;
}
