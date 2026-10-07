import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/frontend/components/product/product-card";
import { ProductConfigurator } from "@/frontend/components/product/product-configurator";
import { ProductGallery } from "@/frontend/components/product/product-gallery";
import { ReviewForm } from "@/frontend/components/product/review-form";
import { Badge } from "@/frontend/components/ui/badge";
import { Reveal } from "@/frontend/components/ui/reveal";
import { Stars } from "@/frontend/components/ui/stars";
import { formatDate } from "@/shared/i18n/config";
import { getI18n } from "@/shared/i18n/server";
import { getCurrentUser } from "@/backend/auth/session";
import { prisma } from "@/backend/db";
import { getContactHref } from "@/backend/site-data";
import { getProductDetail, listRelated } from "@/backend/services/product";
import { listProductReviews } from "@/backend/services/review";

export async function generateMetadata(props: PageProps<"/wall-art/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const { locale } = await getI18n();
  const p = await getProductDetail(slug, locale);
  if (!p) return {};
  const description = p.seoDescription || p.description.slice(0, 160);
  return {
    title: p.seoTitle || p.name,
    description,
    alternates: { canonical: `/wall-art/${p.slug}` },
    openGraph: { title: p.name, description, images: p.images.slice(0, 1).map((i) => ({ url: i.url, alt: i.alt })) },
  };
}

export default async function ProductPage(props: PageProps<"/wall-art/[slug]">) {
  const { slug } = await props.params;
  const { t, locale } = await getI18n();
  const product = await getProductDetail(slug, locale);
  if (!product) notFound();

  const [reviews, related, user] = await Promise.all([listProductReviews(product.id), listRelated(product.id, product.categoryId, locale), getCurrentUser()]);
  const [profile, contactHref] = await Promise.all([
    user ? prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true, email: true, phone: true } }) : null,
    getContactHref(`Boulboul Art Wall — ${product.name} : ${t("product.surMesureMode")}`),
  ]);

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((i) => (i.url.startsWith("http") ? i.url : `${appUrl}${i.url}`)),
    brand: { "@type": "Brand", name: "Boulboul Art Wall" },
    category: product.category?.name,
    // Only configured prices are published; a product without one has no offer.
    ...(product.fromPrice != null
      ? { offers: { "@type": "Offer", priceCurrency: "DZD", price: product.fromPrice, availability: "https://schema.org/PreOrder", url: `${appUrl}/wall-art/${product.slug}` } }
      : {}),
    ...(product.rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating.average.toFixed(1), reviewCount: product.rating.count } } : {}),
  };

  const specs = [
    product.materials && { label: t("product.materials"), value: product.materials },
    product.weightKg && { label: t("product.weight"), value: `${product.weightKg} kg` },
    product.depthCm && { label: t("product.depth"), value: `${product.depthCm} cm` },
    { label: t("product.availability"), value: t("product.madeToOrder") },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="container-page pt-28 pb-24 md:pt-32">
        <nav aria-label="Breadcrumb" className="mb-8 text-xs text-stone">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/wall-art" className="hover:text-ivory">{t("product.breadcrumb")}</Link></li>
            {product.category && (
              <>
                <li aria-hidden>/</li>
                <li><Link href={`/wall-art?category=${product.category.slug}`} className="hover:text-ivory">{product.category.name}</Link></li>
              </>
            )}
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-sand">{product.name}</li>
          </ol>
        </nav>

        <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ProductGallery images={product.images} name={product.name} />
          </div>

          <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {product.category && <p className="eyebrow">{product.category.name}</p>}
                {product.promoActive && <Badge tone="ember">{t("shop.promo")}</Badge>}
                {product.isDemo && <Badge tone="demo">{t("common.demoNotice")}</Badge>}
              </div>
              <h1 className="font-display text-title font-light tracking-[-0.02em] text-balance">{product.name}</h1>
              {product.rating && (
                <a href="#reviews" className="flex items-center gap-2 text-sm text-sand hover:text-ivory">
                  <Stars value={product.rating.average} label={t("reviews.stars", { count: product.rating.average.toFixed(1) })} />
                  <span className="tabular-nums">({product.rating.count})</span>
                </a>
              )}
            </header>

            <ProductConfigurator
              product={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                image: product.images[0]?.url ?? null,
                isDemo: product.isDemo,
                hasPricing: product.hasPricing,
                measures: product.measures,
                surMesure: product.surMesure,
                frames: product.frames,
                defaultFrameId: product.defaultFrameId,
                extras: product.extras,
                colors: product.colors,
                promoActive: product.promoActive,
                promoEndsAt: product.promoEndsAt?.toISOString() ?? null,
              }}
              customer={profile ? { customerName: profile.fullName, email: profile.email, phone: profile.phone ?? "" } : null}
              contactHref={contactHref}
            />

            <section aria-labelledby="desc-title" className="flex flex-col gap-4 border-t border-line pt-8">
              <h2 id="desc-title" className="text-[13px] font-bold uppercase tracking-[0.14em] text-sand">{t("product.description")}</h2>
              <p className="whitespace-pre-line leading-relaxed text-sand">{product.description}</p>
              {product.characteristics.length > 0 && (
                <ul className="mt-2 flex flex-col gap-2 text-sm text-sand">
                  {product.characteristics.map((c) => (
                    <li key={c} className="flex gap-3"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />{c}</li>
                  ))}
                </ul>
              )}
              <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-field border border-line bg-line text-sm">
                {specs.map((s) => (
                  <div key={s.label} className="bg-ink p-4">
                    <dt className="text-xs text-stone">{s.label}</dt>
                    <dd className="mt-1 font-semibold">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </div>

        <section id="reviews" aria-labelledby="reviews-title" className="mt-24 grid gap-12 border-t border-line pt-16 lg:grid-cols-[1fr_1.4fr]">
          <div className="flex flex-col gap-6">
            <h2 id="reviews-title" className="font-display text-heading">{t("reviews.title")}</h2>
            <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-sand">{t("reviews.write")}</h3>
            <ReviewForm productId={product.id} signedIn={!!user} slug={product.slug} />
          </div>
          {reviews.length ? (
            <ul className="flex flex-col gap-4">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-panel border border-line bg-umber-900/60 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Stars value={r.rating} />
                    <span className="text-xs text-stone">{formatDate(r.createdAt, locale)}</span>
                  </div>
                  <p className="mt-3 leading-relaxed text-sand">{r.comment}</p>
                  <p className="mt-4 flex items-center gap-2 text-sm font-semibold">
                    {r.authorName}
                    {r.verifiedPurchase && <Badge tone="sage">{t("reviews.verified")}</Badge>}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sand">{t("reviews.none")}</p>
          )}
        </section>

        {related.length > 0 && (
          <section aria-labelledby="related-title" className="mt-24 border-t border-line pt-16">
            <h2 id="related-title" className="mb-12 font-display text-heading">{t("product.related")}</h2>
            <ul className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p, i) => (
                <Reveal as="li" key={p.id} delay={i * 0.06}>
                  <ProductCard product={p} sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 92vw" />
                </Reveal>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
