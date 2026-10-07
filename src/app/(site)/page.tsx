import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { CardHandGallery } from "@/frontend/components/home/card-hand-gallery";
import { CollectionsShowcase } from "@/frontend/components/home/collections-showcase";
import { CustomProcess } from "@/frontend/components/home/custom-process";
import { HeroFan } from "@/frontend/components/home/hero-fan";
import { TestimonialsColumns } from "@/frontend/components/home/testimonials-columns";
import { ProductCard } from "@/frontend/components/product/product-card";
import { FounderCard } from "@/frontend/components/site/founder-card";
import { ButtonLink } from "@/frontend/components/ui/button";
import { Reveal } from "@/frontend/components/ui/reveal";
import { Section, SectionHeading } from "@/frontend/components/ui/section";
import { formatPrice } from "@/shared/i18n/config";
import { getI18n } from "@/shared/i18n/server";
import { getHomeContent } from "@/backend/cms-content";
import { listActiveCategories, listCatalog, listFeatured } from "@/backend/services/product";
import { listTestimonials } from "@/backend/services/review";

export default async function HomePage() {
  const { t, locale, messages } = await getI18n();
  const [content, featured, categories, testimonials, gallery] = await Promise.all([
    getHomeContent(locale),
    listFeatured(locale, 6),
    listActiveCategories(locale),
    listTestimonials(locale),
    listCatalog({ pageSize: 21, sort: "featured" }, locale),
  ]);
  const handCards = gallery.items
    .filter((p) => p.image)
    .slice(0, 7)
    .map((p) => ({
      id: p.id,
      src: p.image!.url,
      title: p.name,
      description: [p.category, p.fromPrice != null ? `${t("common.from")} ${formatPrice(p.fromPrice, locale)}` : null].filter(Boolean).join(" · "),
      href: `/wall-art/${p.slug}`,
    }));
  const customSteps = messages.home.customSteps;

  return (
    <>
      <HeroFan content={content.hero} />

      {(content.intro.title || content.intro.text) && (
        <Section id="presentation" className="scroll-mt-24 pb-8 md:pb-12">
          <div className="container-page grid gap-10 lg:grid-cols-12">
            <Reveal className="lg:col-span-7">
              <h2 className="font-display text-title font-light tracking-[-0.02em] text-balance">{content.intro.title}</h2>
            </Reveal>
            {content.intro.text && (
              <Reveal delay={0.1} className="lg:col-span-5 lg:pt-4">
                <p className="text-lg leading-relaxed text-sand">{content.intro.text}</p>
              </Reveal>
            )}
          </div>
        </Section>
      )}

      {featured.length > 0 && (
        <Section labelledBy="featured-title" className="wall-surface grain">
          <div className="container-page flex flex-col gap-14">
            <SectionHeading
              id="featured-title"
              eyebrow={t("home.featuredEyebrow")}
              title={t("home.featuredTitle")}
              action={
                <ButtonLink href="/wall-art" variant="outline">
                  {t("common.viewAll")} <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
                </ButtonLink>
              }
            />
            <ul className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p, i) => (
                <Reveal as="li" key={p.id} delay={(i % 3) * 0.08}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {categories.some((c) => c.image) && (
        <Section labelledBy="categories-title">
          <div className="container-page flex flex-col gap-14">
            <SectionHeading id="categories-title" eyebrow={t("home.categoriesEyebrow")} title={t("home.categoriesTitle")} />
            <CollectionsShowcase
              items={categories
                .filter((c) => c.image)
                .map((c) => ({ slug: c.slug, name: c.name, href: `/wall-art?category=${c.slug}`, image: c.image!.url, count: t("shop.results", { count: c.count }) }))}
            />
          </div>
        </Section>
      )}

      {handCards.length >= 3 && (
        <Section labelledBy="gallery-title" className="overflow-hidden border-y border-line bg-umber-950">
          <div className="container-page flex flex-col gap-10">
            <SectionHeading id="gallery-title" align="center" eyebrow={t("home.galleryEyebrow")} title={t("home.galleryTitle")} intro={t("home.galleryHint")} />
            <CardHandGallery cards={handCards} className="mx-auto max-w-5xl" ctaLabel={t("shop.viewProduct")} />
          </div>
        </Section>
      )}

      <Section labelledBy="custom-title" className="overflow-hidden">
        <div className="container-page">
          <CustomProcess
            eyebrow={t("home.customEyebrow")}
            title={t("home.customTitle")}
            text={t("home.customText")}
            steps={customSteps}
            cta={{ label: t("home.customCta"), href: "/customize" }}
          />
        </div>
      </Section>

      {content.why.pillars.length > 0 && (
        <Section labelledBy="why-title" className="border-t border-line bg-umber-950">
          <div className="container-page flex flex-col gap-12">
            <SectionHeading
              id="why-title"
              eyebrow={t("nav.why")}
              title={content.why.title || t("why.title")}
              intro={content.why.intro}
              action={
                <ButtonLink href="/why-boulboul" variant="outline">
                  {t("common.discover")} <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
                </ButtonLink>
              }
            />
            <ul className="grid gap-px overflow-hidden rounded-panel border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
              {content.why.pillars.slice(0, 6).map((p, i) => (
                <Reveal as="li" key={p.title} delay={i * 0.06} className="flex flex-col gap-4 bg-umber-950 p-8">
                  <span className="font-display text-sm text-gold tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="font-display text-2xl">{p.title}</h3>
                  <p className="leading-relaxed text-sand">{p.text}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {content.quality.text && (
        <Section id="qualite" labelledBy="quality-title" className="scroll-mt-24">
          <div className="container-page grid items-center gap-12 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              {content.quality.eyebrow && <p className="eyebrow">{content.quality.eyebrow}</p>}
              <h2 id="quality-title" className="font-display text-title font-light">{content.quality.title}</h2>
              <p className="whitespace-pre-line text-lg leading-relaxed text-sand">{content.quality.text}</p>
            </div>
            {content.quality.image && (
              <div className="relative aspect-[4/3] overflow-hidden rounded-art shadow-lifted">
                <Image src={content.quality.image} alt="" fill sizes="(min-width: 1024px) 45vw, 92vw" className="object-cover" />
              </div>
            )}
          </div>
        </Section>
      )}

      {testimonials.length > 0 && (
        <Section id="avis" labelledBy="reviews-title" className="scroll-mt-24 border-t border-line">
          <div className="container-page flex flex-col gap-14">
            <SectionHeading id="reviews-title" align="center" eyebrow={content.testimonials.eyebrow || t("home.reviewsEyebrow")} title={content.testimonials.title || t("home.reviewsTitle")} intro={content.testimonials.subtitle} />
            <TestimonialsColumns items={testimonials} />
          </div>
        </Section>
      )}

      {content.about.founders.length > 0 && (
        <Section labelledBy="founders-title" className="border-t border-line">
          <div className="container-page flex flex-col gap-14">
            <SectionHeading
              id="founders-title"
              eyebrow={t("about.foundersEyebrow")}
              title={content.about.title || t("about.title")}
              intro={content.about.intro}
              action={
                <ButtonLink href="/about" variant="outline">
                  {t("common.discover")}
                </ButtonLink>
              }
            />
            <div className="grid gap-10 md:grid-cols-2">
              {content.about.founders.map((f, i) => (
                <FounderCard key={f.name} founder={f} index={i} />
              ))}
            </div>
          </div>
        </Section>
      )}

      {content.finalCta.title && (
        <section id="appel" className="relative isolate scroll-mt-24 overflow-hidden">
          {content.finalCta.image && <Image src={content.finalCta.image} alt="" fill sizes="100vw" className="-z-10 object-cover" />}
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-ink via-ink/60 to-ink" />
          <div className="container-page flex flex-col items-center gap-8 py-28 text-center md:py-40">
            <Reveal>
              <h2 className="font-display text-display font-light tracking-[-0.025em] text-balance">{content.finalCta.title}</h2>
            </Reveal>
            {content.finalCta.text && <p className="max-w-xl text-lg text-sand">{content.finalCta.text}</p>}
            {content.finalCta.button && (
              <ButtonLink href={content.finalCta.button.href} size="lg">
                {content.finalCta.button.label} <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
              </ButtonLink>
            )}
          </div>
        </section>
      )}
    </>
  );
}
