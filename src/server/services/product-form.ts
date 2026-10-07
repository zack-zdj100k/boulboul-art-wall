import "server-only";
import type { ProductFormValue } from "@/components/admin/product-editor";
import { prisma } from "@/server/db";
import { mediaUrl } from "@/server/storage";
import { surMesureFromProduct, surMesureSelect } from "./pricing";

const s = (v: unknown) => (v == null ? "" : String(v));
const dt = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");

export const EMPTY_PRODUCT: ProductFormValue = {
  name: "", nameAr: "", slug: "", description: "", descriptionAr: "",
  categoryId: "", status: "DRAFT", isFeatured: false, isDemo: false, sortOrder: "0",
  promoType: "", promoValue: "", promoStartsAt: "", promoEndsAt: "",
  materials: "", weightKg: "", depthCm: "", colors: "", characteristics: "", seoTitle: "", seoDescription: "",
  images: [], frames: [], extras: [],
};

export async function loadProductForm(id: string): Promise<ProductFormValue | null> {
  const p = await prisma.product.findUnique({
    where: { id },
    include: { images: { include: { media: true }, orderBy: { sortOrder: "asc" } }, frames: true, extras: true },
  });
  if (!p) return null;
  return {
    name: p.name, nameAr: s(p.nameAr), slug: p.slug,
    description: p.description, descriptionAr: s(p.descriptionAr),
    categoryId: s(p.categoryId), status: p.status, isFeatured: p.isFeatured, isDemo: p.isDemo, sortOrder: s(p.sortOrder),
    promoType: p.promoType ?? "", promoValue: s(p.promoValue), promoStartsAt: dt(p.promoStartsAt), promoEndsAt: dt(p.promoEndsAt),
    materials: s(p.materials), weightKg: s(p.weightKg), depthCm: s(p.depthCm), colors: p.colors.join(", "), characteristics: p.characteristics.join("\n"),
    seoTitle: s(p.seoTitle), seoDescription: s(p.seoDescription),
    images: p.images.map((i) => ({ mediaId: i.mediaId, url: mediaUrl(i.media.key), alt: s(i.alt) })),
    frames: p.frames.map((f) => ({ frameId: f.frameId, priceOverride: s(f.priceOverride), isDefault: f.isDefault })),
    extras: p.extras.map((e) => ({ extraId: e.extraId, priceOverride: s(e.priceOverride) })),
  };
}

export async function loadEditorOptions() {
  const [categories, frames, extras] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.frameOption.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, price: true, isActive: true } }),
    prisma.extraOption.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, price: true, isActive: true } }),
  ]);
  return { categories, frames, extras };
}

/** Measures and Sur Mesure parameters of a product, for the admin "Tarification" tab. */
export async function loadProductPricing(productId: string) {
  const [measures, p] = await Promise.all([
    prisma.productMeasure.findMany({ where: { productId }, orderBy: [{ widthCm: "asc" }, { heightCm: "asc" }] }),
    prisma.product.findUnique({ where: { id: productId }, select: surMesureSelect }),
  ]);
  return {
    measures: measures.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
    surMesure: p ? surMesureFromProduct(p) : null,
  };
}
