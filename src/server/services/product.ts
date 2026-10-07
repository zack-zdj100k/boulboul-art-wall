import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { pick, type Locale } from "@/i18n/config";
import { parseColors } from "@/lib/options";
import { prisma } from "@/server/db";
import { AppError } from "@/server/http";
import { mediaUrl } from "@/server/storage";
import { hasActivePricing, isPromotionActive, isSurMesureConfigured, startingPrice, surMesureFromProduct, type PricingProduct } from "./pricing";

const activeRows = {
  where: { isActive: true, price: { gt: 0 } },
  orderBy: [{ widthCm: "asc" }, { heightCm: "asc" }],
} satisfies Prisma.Product$measuresArgs;

export const pricingInclude = {
  measures: activeRows,
  frames: { include: { frame: true }, orderBy: { frame: { sortOrder: "asc" } } },
  extras: { include: { extra: true }, orderBy: { extra: { sortOrder: "asc" } } },
} satisfies Prisma.ProductInclude;

type ProductWithPricing = Prisma.ProductGetPayload<{ include: typeof pricingInclude }>;

/** Maps a product with its (active) measures, Sur Mesure parameters and options to the pricing engine's input. */
export function toPricingProduct(p: ProductWithPricing): PricingProduct {
  return {
    id: p.id,
    promoType: p.promoType,
    promoValue: p.promoValue,
    promoStartsAt: p.promoStartsAt,
    promoEndsAt: p.promoEndsAt,
    measures: p.measures.map((r) => ({ id: r.id, widthCm: r.widthCm, heightCm: r.heightCm, price: r.price, isActive: r.isActive, label: r.label, description: r.description })),
    surMesure: surMesureFromProduct(p),
    frames: p.frames.map((f) => ({ id: f.frame.id, name: f.frame.name, price: f.priceOverride ?? f.frame.price, isActive: f.frame.isActive })),
    extras: p.extras.map((e) => ({ id: e.extra.id, name: e.extra.name, price: e.priceOverride ?? e.extra.price, isActive: e.extra.isActive })),
  };
}

/** Products that can currently be bought. */
export const purchasableWhere = { status: "ACTIVE", archivedAt: null } satisfies Prisma.ProductWhereInput;

export async function getPurchasableProducts(ids: string[]) {
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, ...purchasableWhere },
    include: { ...pricingInclude, images: { include: { media: true }, orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  return new Map(products.map((p) => [p.id, p]));
}

// ───────────────────────── Catalogue (public)

const cardInclude = {
  ...pricingInclude,
  category: true,
  images: { include: { media: true }, orderBy: { sortOrder: "asc" }, take: 2 },
} satisfies Prisma.ProductInclude;

type CardSource = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  categorySlug: string | null;
  image: { url: string; alt: string; width: number | null; height: number | null } | null;
  hoverImage: { url: string; alt: string } | null;
  /** Lowest configured price after promotion; null = no active price configured (nothing shown). */
  fromPrice: number | null;
  originalPrice: number | null;
  hasPromo: boolean;
  framesCount: number;
  swatches: { name: string; color: string }[];
  allowCustomSize: boolean;
  sizesLabel: string | null;
  isDemo: boolean;
  isFeatured: boolean;
  createdAt: Date;
};

function toCard(p: CardSource, locale: Locale, now: Date): ProductCard {
  const price = startingPrice({ ...p, surMesure: surMesureFromProduct(p) }, now);
  const name = pick(p, "name", locale);
  const [first, second] = p.images;
  const sizes = p.measures;
  return {
    id: p.id,
    slug: p.slug,
    name,
    category: p.category ? pick(p.category, "name", locale) : null,
    categorySlug: p.category?.slug ?? null,
    image: first ? { url: mediaUrl(first.media.key), alt: first.alt || first.media.alt || name, width: first.media.width, height: first.media.height } : null,
    hoverImage: second ? { url: mediaUrl(second.media.key), alt: second.alt || name } : null,
    fromPrice: price?.final ?? null,
    originalPrice: price?.original ?? null,
    hasPromo: !!price?.promoActive && price.final < price.original,
    framesCount: p.frames.filter((f) => f.frame.isActive).length,
    swatches: p.frames
      .filter((f) => f.frame.isActive && f.frame.swatch)
      .map((f) => ({ name: pick(f.frame, "name", locale), color: f.frame.swatch! })),
    allowCustomSize: isSurMesureConfigured(surMesureFromProduct(p)),
    sizesLabel: isSurMesureConfigured(surMesureFromProduct(p)) ? "Sur Mesure" : !sizes.length ? null : sizes.length === 1 ? `${sizes[0].widthCm}×${sizes[0].heightCm} cm` : `${sizes.length} formats`,
    isDemo: p.isDemo,
    isFeatured: p.isFeatured,
    createdAt: p.createdAt,
  };
}

export type CatalogQuery = {
  q?: string;
  category?: string;
  min?: number;
  max?: number;
  sort?: "featured" | "newest" | "priceAsc" | "priceDesc";
  page?: number;
  pageSize?: number;
};

// Prices depend on the price tables and promotions, so filtering/sorting by price happens on the
// card's starting price (products without a configured price never match a price filter). Fine for a boutique catalogue (hundreds of items); denormalise if it grows.
export async function listCatalog(query: CatalogQuery, locale: Locale) {
  const pageSize = Math.min(48, Math.max(1, query.pageSize ?? 12));
  const q = query.q?.trim().slice(0, 80);
  const where: Prisma.ProductWhereInput = {
    ...purchasableWhere,
    ...(query.category ? { category: { slug: query.category, isActive: true } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { nameAr: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { category: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const rows = await prisma.product.findMany({ where, include: cardInclude, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  const now = new Date();
  let cards = rows.map((p) => toCard(p, locale, now));
  if (query.min != null) cards = cards.filter((c) => c.fromPrice != null && c.fromPrice >= query.min!);
  if (query.max != null) cards = cards.filter((c) => c.fromPrice != null && c.fromPrice <= query.max!);
  // Unpriced products always sort last.
  const priceOf = (c: ProductCard, dir: 1 | -1) => c.fromPrice ?? dir * Number.MAX_SAFE_INTEGER;

  switch (query.sort) {
    case "newest":
      cards.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      break;
    case "priceAsc":
      cards.sort((a, b) => priceOf(a, 1) - priceOf(b, 1));
      break;
    case "priceDesc":
      cards.sort((a, b) => priceOf(b, -1) - priceOf(a, -1));
      break;
    default:
      cards.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
  }

  const total = cards.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pages, Math.max(1, query.page ?? 1));
  return { items: cards.slice((page - 1) * pageSize, page * pageSize), total, page, pages, pageSize };
}

export async function listFeatured(locale: Locale, take = 8) {
  const rows = await prisma.product.findMany({
    where: { ...purchasableWhere, isFeatured: true },
    include: cardInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take,
  });
  const now = new Date();
  return rows.map((p) => toCard(p, locale, now));
}

export async function listRelated(productId: string, categoryId: string | null, locale: Locale, take = 4) {
  const rows = await prisma.product.findMany({
    where: { ...purchasableWhere, id: { not: productId }, ...(categoryId ? { categoryId } : {}) },
    include: cardInclude,
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take,
  });
  const now = new Date();
  return rows.map((p) => toCard(p, locale, now));
}

export async function listActiveCategories(locale: Locale) {
  const cats = await prisma.category.findMany({
    where: { isActive: true, products: { some: purchasableWhere } },
    include: {
      image: true,
      products: {
        where: purchasableWhere,
        take: 1,
        orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
        include: { images: { include: { media: true }, orderBy: { sortOrder: "asc" }, take: 1 } },
      },
      _count: { select: { products: { where: purchasableWhere } } },
    },
    orderBy: { sortOrder: "asc" },
  });
  return cats.map((c) => {
    const fallback = c.products[0]?.images[0]?.media;
    const img = c.image ?? fallback ?? null;
    return {
      id: c.id,
      slug: c.slug,
      name: pick(c, "name", locale),
      description: pick(c, "description", locale) || null,
      count: c._count.products,
      image: img ? { url: mediaUrl(img.key), alt: pick(c, "name", locale) } : null,
    };
  });
}

// ───────────────────────── Product detail

export async function getProductDetail(slug: string, locale: Locale) {
  const p = await prisma.product.findFirst({
    where: { slug, ...purchasableWhere },
    include: {
      ...pricingInclude,
      category: true,
      images: { include: { media: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!p) return null;
  const now = new Date();
  const surMesure = surMesureFromProduct(p);
  const from = startingPrice({ ...p, surMesure }, now);
  const [ratingAgg] = await Promise.all([
    prisma.review.aggregate({ where: { productId: p.id, status: "APPROVED" }, _avg: { rating: true }, _count: true }),
  ]);
  const name = pick(p, "name", locale);
  const defaultFrame = p.frames.find((f) => f.isDefault && f.frame.isActive);
  return {
    id: p.id,
    slug: p.slug,
    name,
    description: pick(p, "description", locale),
    category: p.category ? { name: pick(p.category, "name", locale), slug: p.category.slug, id: p.category.id } : null,
    images: p.images.map((i) => ({ id: i.id, url: mediaUrl(i.media.key), alt: i.alt || i.media.alt || name, width: i.media.width, height: i.media.height })),
    isDemo: p.isDemo,
    materials: p.materials,
    weightKg: p.weightKg ? Number(p.weightKg) : null,
    depthCm: p.depthCm ? Number(p.depthCm) : null,
    colors: p.colors,
    characteristics: p.characteristics,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    fromPrice: from?.final ?? null,
    originalPrice: from?.original ?? null,
    promoActive: isPromotionActive(p, now),
    promoEndsAt: p.promoEndsAt,
    hasPricing: hasActivePricing({ measures: p.measures, surMesure }),
    // Dimensions only — prices always come from the server quote.
    measures: p.measures.map((r) => ({ widthCm: r.widthCm, heightCm: r.heightCm, label: r.label, description: r.description })),
    surMesure: isSurMesureConfigured(surMesure)
      ? {
          refWidthCm: surMesure.refWidthCm!,
          refHeightCm: surMesure.refHeightCm!,
          minWidthCm: surMesure.minWidthCm ?? null,
          maxWidthCm: surMesure.maxWidthCm ?? null,
          minHeightCm: surMesure.minHeightCm ?? null,
          maxHeightCm: surMesure.maxHeightCm ?? null,
        }
      : null,
    frames: p.frames
      .filter((f) => f.frame.isActive)
      .map((f) => ({ id: f.frame.id, name: pick(f.frame, "name", locale), swatch: f.frame.swatch, description: f.frame.description })),
    defaultFrameId: defaultFrame?.frameId ?? null,
    extras: p.extras
      .filter((e) => e.extra.isActive)
      .map((e) => ({
        id: e.extra.id,
        name: pick(e.extra, "name", locale),
        description: e.extra.description,
        price: e.priceOverride ?? e.extra.price,
        colors: parseColors(e.extra.colors),
        notePrompt: e.extra.askNote ? pick(e.extra, "notePrompt", locale) || null : null,
      })),
    rating: ratingAgg._count ? { average: ratingAgg._avg.rating ?? 0, count: ratingAgg._count } : null,
    categoryId: p.categoryId,
    updatedAt: p.updatedAt,
  };
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductDetail>>>;

export async function getPricingProductOrThrow(id: string) {
  const p = await prisma.product.findFirst({ where: { id, ...purchasableWhere }, include: pricingInclude });
  if (!p) throw new AppError(404, "errors.productUnavailable");
  return toPricingProduct(p);
}
