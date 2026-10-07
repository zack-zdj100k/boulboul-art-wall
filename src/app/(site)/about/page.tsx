import type { Metadata } from "next";
import Image from "next/image";
import { FounderCard } from "@/frontend/components/site/founder-card";
import { ButtonLink } from "@/frontend/components/ui/button";
import { Reveal } from "@/frontend/components/ui/reveal";
import { getI18n } from "@/shared/i18n/server";
import { TestimonialsColumns } from "@/frontend/components/home/testimonials-columns";
import { SectionHeading } from "@/frontend/components/ui/section";
import { getAboutContent, getHomeContent } from "@/backend/cms-content";
import { listTestimonials } from "@/backend/services/review";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  const about = await getAboutContent(locale);
  return { title: about.title || t("about.title"), description: about.intro || undefined, alternates: { canonical: "/about" } };
}

export default async function AboutPage() {
  const { t, locale } = await getI18n();
  const [about, home, testimonials] = await Promise.all([getAboutContent(locale), getHomeContent(locale), listTestimonials(locale)]);
  const hasStory = !!(about.story || about.intro);

  return (
    <div className="pt-36 pb-28 md:pt-44">
      <div className="container-page flex flex-col gap-24">
        <Reveal className="flex max-w-4xl flex-col gap-6">
          <p className="eyebrow">{t("about.storyEyebrow")}</p>
          <h1 className="font-display text-display font-light tracking-[-0.025em] text-balance">{about.title || t("about.title")}</h1>
          {about.intro && <p className="max-w-2xl text-xl leading-relaxed text-sand">{about.intro}</p>}
        </Reveal>

        {(hasStory || about.storyImage) && (
          <section className="grid items-start gap-12 lg:grid-cols-2" aria-label={t("about.storyEyebrow")}>
            {about.storyImage && (
              <Reveal className="relative aspect-[4/5] overflow-hidden rounded-art shadow-lifted lg:sticky lg:top-28">
                <Image src={about.storyImage} alt="" fill sizes="(min-width: 1024px) 45vw, 92vw" className="object-cover" />
              </Reveal>
            )}
            {about.story ? (
              <Reveal delay={0.1} className="flex flex-col gap-6 text-lg leading-[1.8] text-sand">
                {about.story.split(/\n{2,}/).map((para, i) => (
                  <p key={i} className={i === 0 ? "font-display text-2xl leading-snug text-ivory first-letter:float-start first-letter:me-3 first-letter:text-7xl first-letter:leading-[0.8] first-letter:text-gold" : ""}>
                    {para}
                  </p>
                ))}
              </Reveal>
            ) : (
              <Reveal delay={0.1} className="flex flex-col gap-6 self-center">
                <p className="font-display text-3xl font-light text-ivory">{t("home.customTitle")}</p>
                <p className="text-lg text-sand">{t("home.customText")}</p>
                <div><ButtonLink href="/wall-art">{t("home.finalCta")}</ButtonLink></div>
              </Reveal>
            )}
          </section>
        )}

        {about.founders.length > 0 && (
          <section aria-labelledby="founders" className="flex flex-col gap-14 border-t border-line pt-20">
            <h2 id="founders" className="eyebrow">{t("about.foundersEyebrow")}</h2>
            <div className="grid gap-12 md:grid-cols-2">
              {about.founders.map((f, i) => (
                <FounderCard key={f.name} founder={f} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* Same real, approved reviews as on the home page (moving columns). */}
        {testimonials.length > 0 && (
          <section id="avis" aria-labelledby="about-reviews-title" className="flex scroll-mt-24 flex-col gap-14 border-t border-line pt-20">
            <SectionHeading
              id="about-reviews-title"
              align="center"
              eyebrow={home.testimonials.eyebrow || t("home.reviewsEyebrow")}
              title={home.testimonials.title || t("home.reviewsTitle")}
              intro={home.testimonials.subtitle}
            />
            <TestimonialsColumns items={testimonials} />
          </section>
        )}
      </div>
    </div>
  );
}
