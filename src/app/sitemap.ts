import type { MetadataRoute } from "next";
import { prisma } from "@/backend/db";
import { purchasableWhere } from "@/backend/services/product";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where: purchasableWhere, select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
  ]);
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/wall-art`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/customize`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/why-boulboul`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    ...categories.map((c) => ({ url: `${base}/wall-art?category=${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...products.map((p) => ({ url: `${base}/wall-art/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
