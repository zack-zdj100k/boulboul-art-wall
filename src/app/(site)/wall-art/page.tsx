import { ArrowRight, BadgeCheck, Frame, Ruler, Plus } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { CatalogFilters } from "@/components/product/catalog-filters";
import { ProductTile } from "@/components/shop/product-tile";
import { ShopHero } from "@/components/shop/shop-hero";
import { BrandMark } from "@/components/site/brand";
import { ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Reveal } from "@/components/ui/reveal";
import { formatPrice } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { listActiveCategories, listCatalog, listFeatured } from "@/server/services/product";

const querySchema = z.object({
  q: z.string().max(80).optional().catch(undefined),
  category: z.string().max(80).optional().catch(undefined),
  min: z.coerce.number().int().min(0).optional().catch(undefined),
  max: z.coerce.number().int().min(0).optional().catch(undefined),
  sort: z.enum(["featured", "newest", "priceAsc", "priceDesc"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("shop.title"), description: t("shop.intro"), alternates: { canonical: "/wall-art" } };
}

const PERK_ICONS = [Ruler, Frame, BadgeCheck];

// Uppercase, tracked section titles — this page's editorial voice.
function Heading({ id, children, action }: { id: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 id={id} className="text-sm font-extrabold tracking-[0.14em] text-ivory uppercase">
        {children}
      </h2>
      {action}
    </div>
  );
}

export default async function WallArtPage(props: PageProps<"/wall-art">) {
  const sp = await props.searchParams;
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const query = querySchema.parse(flat);
  const { t, locale, messages } = await getI18n();
  const [result, categories, featured] = await Promise.all([
    listCatalog({ ...query, pageSize: 12 }, locale),
    listActiveCategories(locale),
    listFeatured(locale, 8),
  ]);
  const filtered = !!(query.q || query.category || query.min || query.max || query.sort || (query.page ?? 1) > 1);

  const pageHref = (p: number) => {
    const next = new URLSearchParams(Object.entries(flat).filter(([, v]) => v) as [string, string][]);
    if (p > 1) next.set("page", String(p));
    else next.delete("page");
    return `/wall-art${next.size ? `?${next}` : ""}#collection`;
  };

  const slides = featured
    .filter((p) => p.image)
    .slice(0, 4)
    .map((p) => ({ image: p.image!.url, alt: p.image!.alt, name: p.name, href: `/wall-art/${p.slug}` }));

  // A "complete wall": one featured piece per category, up to four.
  const seen = new Set<string>();
  // Only priced pieces: the bundle total is a sum of configured starting prices, never a guess.
  const bundle = featured.filter((p) => p.image && p.fromPrice != null && !seen.has(p.categorySlug ?? p.id) && seen.add(p.categorySlug ?? p.id)).slice(0, 4);
  const bundleTotal = bundle.reduce((s, p) => s + (p.fromPrice ?? 0), 0);

  const tiles = categories.slice(0, 4);
  const explore = [
    ...categories.slice(4).map((c) => ({ key: c.slug, label: c.name, href: `/wall-art?category=${c.slug}#collection`, image: c.image?.url })),
    { key: "new", label: t("shop.exploreNew"), href: "/wall-art?sort=newest#collection", image: featured[1]?.image?.url },
    { key: "featured", label: t("shop.exploreFeatured"), href: "/wall-art?sort=featured#collection", image: featured[2]?.image?.url },
    { key: "custom", label: t("shop.exploreCustom"), href: "/customize", image: "/brand/products/kingfood-poster-lit.jpg" },
  ].filter((e) => e.image);

  return (
    <>
      {slides.length > 0 && <ShopHero slides={slides} anchor="collection" />}

      <div className={cn("relative z-10 rounded-t-[28px] bg-ink", slides.length > 0 ? "-mt-7" : "pt-24")}>
        <div className="container-page flex flex-col gap-16 pt-8 pb-20 md:gap-20">
          {slides.length === 0 && <h1 className="font-display text-title font-light">{t("shop.title")}</h1>}
          {/* Category tiles */}
          {tiles.length > 0 && (
            <nav aria-label={t("home.categoriesEyebrow")}>
              <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {tiles.map((c, i) => {
                  const active = query.category === c.slug;
                  return (
                    <Reveal as="li" key={c.id} delay={i * 0.05}>
                      <Link
                        href={active ? "/wall-art#collection" : `/wall-art?category=${c.slug}#collection`}
                        aria-current={active ? "page" : undefined}
                        className={cn("group relative flex h-28 overflow-hidden rounded-md bg-night text-paper sm:h-32", active && "ring-2 ring-gold ring-offset-2 ring-offset-ink")}
                      >
                        {c.image && <Image src={c.image.url} alt="" fill sizes="(min-width: 1024px) 24vw, 48vw" className="object-cover opacity-75 transition duration-700 ease-editorial group-hover:scale-105 group-hover:opacity-90" />}
                        <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-night/85 via-night/45 to-transparent rtl:bg-gradient-to-l" />
                        <span className="relative flex flex-col justify-center gap-1 p-4 sm:p-5">
                          <span className="text-[13px] font-extrabold tracking-[0.12em] uppercase">{c.name}</span>
                          <span className="text-[11px] tracking-[0.12em] text-paper/75 uppercase">{t("shop.pieces", { count: c.count })}</span>
                          <span aria-hidden className="mt-2 flex items-center gap-1 text-paper/85">
                            <span className="block h-px w-7 bg-current transition-all duration-500 group-hover:w-11" />
                            <ArrowRight className="size-3.5 rtl:-scale-x-100" />
                          </span>
                        </span>
                      </Link>
                    </Reveal>
                  );
                })}
              </ul>
            </nav>
          )}

          {/* Catalogue */}
          <section id="collection" aria-labelledby="collection-title" className="flex scroll-mt-6 flex-col gap-6">
            <Heading
              id="collection-title"
              action={
                filtered ? (
                  <Link href="/wall-art#collection" className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-ivory uppercase hover:text-gold">
                    {t("common.viewAll")} <ArrowRight className="size-3.5 rtl:-scale-x-100" />
                  </Link>
                ) : undefined
              }
            >
              {t("shop.collectionTitle")}
            </Heading>
            <div className="border-y border-line py-4">
              <Suspense>
                <CatalogFilters categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} total={result.total} />
              </Suspense>
            </div>
            {result.items.length > 0 ? (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
                {result.items.map((p, i) => (
                  <Reveal as="li" key={p.id} delay={(i % 4) * 0.05}>
                    <ProductTile product={p} priority={i < 4} />
                  </Reveal>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-6 rounded-md border border-dashed border-line-strong px-6 py-16 text-center">
                <p className="font-display text-2xl">{filtered ? t("shop.empty") : t("shop.emptyCatalog")}</p>
                <ButtonLink href="/customize" variant="outline">
                  {t("home.customCta")}
                </ButtonLink>
              </div>
            )}
            <Pagination page={result.page} pages={result.pages} href={pageHref} label={t("shop.page", { page: result.page, total: result.pages })} />
          </section>

          {/* Complete wall */}
          {bundle.length >= 2 && (
            <Reveal>
              <section aria-labelledby="bundle-title" className="grid overflow-hidden rounded-md bg-umber-950 lg:grid-cols-[280px_1fr]">
                <div className="flex flex-col justify-center gap-4 p-7 sm:p-9">
                  <p className="text-[10px] font-bold tracking-[0.2em] text-stone uppercase">{t("shop.bundleEyebrow")}</p>
                  <h2 id="bundle-title" className="text-2xl leading-tight font-extrabold tracking-[0.02em] uppercase">
                    {t("shop.bundleTitle")}
                  </h2>
                  <p className="text-xs leading-relaxed tracking-[0.04em] text-sand uppercase">{t("shop.bundleText")}</p>
                  <div className="flex flex-col items-start gap-2">
                    <Link href="/customize" className="inline-flex h-10 items-center rounded-[4px] bg-ivory px-5 text-[11px] font-extrabold tracking-[0.14em] text-paper uppercase transition hover:bg-night">
                      {t("shop.bundleCta")}
                    </Link>
                    <p className="text-xs text-stone">
                      {t("shop.bundleTotal")} <span className="font-bold text-ivory tabular-nums">{formatPrice(bundleTotal, locale)}</span>
                    </p>
                  </div>
                </div>
                <div className="wall-surface flex items-center gap-2 overflow-x-auto p-6 scrollbar-none sm:gap-4 sm:p-8">
                  {bundle.map((p, i) => (
                    <div key={p.id} className="flex shrink-0 items-center gap-2 sm:gap-4">
                      {i > 0 && <Plus className="size-4 shrink-0 text-sand" aria-hidden />}
                      <Link href={`/wall-art/${p.slug}`} className="group flex w-32 flex-col items-center gap-3 text-center sm:w-40">
                        <span className="relative block aspect-[4/5] w-full overflow-hidden rounded-[4px] shadow-mounted">
                          <Image src={p.image!.url} alt={p.image!.alt} fill sizes="160px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                        </span>
                        <span className="line-clamp-1 text-[10px] font-bold tracking-[0.12em] uppercase">{p.name}</span>
                        <span className="-mt-2 text-xs text-sand tabular-nums">{formatPrice(p.fromPrice ?? 0, locale)}</span>
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            </Reveal>
          )}

          {/* Advice + perks */}
          <Reveal>
            <section aria-labelledby="advice-title" className="grid gap-8 border-b border-line pb-14 md:grid-cols-[1fr_1.1fr] lg:grid-cols-[1.1fr_1fr_1fr] lg:items-center">
              <div className="relative aspect-[16/10] overflow-hidden rounded-md md:row-span-2 lg:row-span-1">
                <Image src="/brand/scenes/showroom-collection.jpg" alt="" fill sizes="(min-width: 1024px) 34vw, (min-width: 768px) 45vw, 92vw" className="object-cover" />
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-[10px] font-bold tracking-[0.2em] text-stone uppercase">{t("shop.adviceEyebrow")}</p>
                <h2 id="advice-title" className="text-xl leading-tight font-extrabold tracking-[0.02em] uppercase sm:text-2xl">
                  {t("shop.adviceTitle")}
                </h2>
                <p className="text-sm leading-relaxed text-sand">{t("shop.adviceText")}</p>
                <Link href="/customize" className="mt-2 inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] uppercase hover:text-gold">
                  {t("shop.adviceCta")} <ArrowRight className="size-3.5 rtl:-scale-x-100" />
                </Link>
              </div>
              <ul className="flex flex-col gap-5 lg:border-s lg:border-line lg:ps-10">
                {messages.shop.perks.map((perk, i) => {
                  const Icon = PERK_ICONS[i] ?? BadgeCheck;
                  return (
                    <li key={perk.title} className="flex items-start gap-4">
                      <Icon className="mt-0.5 size-6 shrink-0 text-gold" strokeWidth={1.4} aria-hidden />
                      <span>
                        <span className="block text-[11px] font-extrabold tracking-[0.12em] uppercase">{perk.title}</span>
                        <span className="text-xs text-stone">{perk.text}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </Reveal>

          {/* Other universes */}
          {explore.length > 0 && (
            <section aria-labelledby="explore-title" className="flex flex-col gap-5">
              <Heading id="explore-title">{t("shop.exploreTitle")}</Heading>
              <ul className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
                {explore.map((e, i) => (
                  <Reveal as="li" key={e.key} delay={i * 0.05} className="w-[46%] shrink-0 snap-start sm:w-auto">
                    <Link href={e.href} className="group relative flex h-36 items-end overflow-hidden rounded-md bg-night text-paper sm:h-40">
                      <Image src={e.image!} alt="" fill sizes="(min-width: 1024px) 19vw, (min-width: 640px) 31vw, 46vw" className="object-cover opacity-80 transition duration-700 group-hover:scale-105" />
                      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-night/85 via-night/20 to-transparent" />
                      <span className="relative flex w-full items-center justify-between gap-2 p-4">
                        <span className="text-[13px] font-extrabold tracking-[0.1em] uppercase">{e.label}</span>
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 rtl:-scale-x-100" aria-hidden />
                      </span>
                    </Link>
                  </Reveal>
                ))}
              </ul>
            </section>
          )}

          {/* Closing strip */}
          <section aria-label={t("shop.joinTitle")} className="flex flex-col items-center gap-6 border-t border-line pt-10 text-center md:flex-row md:justify-between md:text-start">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-full border border-ivory">
                <BrandMark className="h-6 text-ivory" />
              </span>
              <span className="flex flex-col leading-none" dir="ltr">
                <span className="text-sm tracking-[0.24em]">BOULBOUL</span>
                <span className="mt-1 text-[9px] tracking-[0.4em] text-stone">ART WALL</span>
              </span>
            </div>
            <p className="text-xs leading-relaxed">
              <span className="block font-extrabold tracking-[0.12em] uppercase">{t("shop.joinTitle")}</span>
              <span className="tracking-[0.08em] text-stone uppercase">{t("shop.joinText")}</span>
            </p>
            <Link href="/account/register" className="inline-flex h-12 items-center gap-3 rounded-[4px] bg-ivory px-7 text-[11px] font-extrabold tracking-[0.16em] text-paper uppercase transition hover:bg-night">
              {t("shop.joinCta")} <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
