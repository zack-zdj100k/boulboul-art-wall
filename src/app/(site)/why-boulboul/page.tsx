import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/frontend/components/ui/button";
import { Reveal } from "@/frontend/components/ui/reveal";
import { getI18n } from "@/shared/i18n/server";
import { getWhyContent } from "@/backend/cms-content";

const BLOCK_LABELS: Record<string, Record<string, string>> = {
  materials: { fr: "Matériaux", ar: "المواد" },
  production: { fr: "Fabrication", ar: "الصناعة" },
  guarantees: { fr: "Garanties", ar: "الضمانات" },
  pricing: { fr: "Prix", ar: "الأسعار" },
};
const CERT_LABEL: Record<string, string> = { fr: "Certifications", ar: "الشهادات" };

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  const why = await getWhyContent(locale);
  return { title: why.title || t("why.title"), description: why.intro || undefined, alternates: { canonical: "/why-boulboul" } };
}

export default async function WhyPage() {
  const { t, locale } = await getI18n();
  const why = await getWhyContent(locale);

  return (
    <div className="pt-36 pb-28 md:pt-44">
      <div className="container-page flex flex-col gap-24">
        <Reveal className="flex max-w-4xl flex-col gap-6">
          <p className="eyebrow">Boulboul Art Wall</p>
          <h1 className="font-display text-display font-light tracking-[-0.025em] text-balance">{why.title || t("why.title")}</h1>
          {why.intro && <p className="max-w-2xl text-xl leading-relaxed text-sand">{why.intro}</p>}
        </Reveal>

        {why.pillars.length > 0 && (
          <ol className="flex flex-col">
            {why.pillars.map((p, i) => (
              <Reveal as="li" key={p.title} className="grid gap-8 border-t border-line py-14 md:grid-cols-[120px_1fr_1fr] md:gap-12">
                <span className="font-display text-5xl font-light text-gold tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <div className="flex flex-col gap-4">
                  <h2 className="font-display text-heading">{p.title}</h2>
                  <p className="whitespace-pre-line text-lg leading-relaxed text-sand">{p.text}</p>
                </div>
                {p.image && (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-art shadow-mounted">
                    <Image src={p.image} alt="" fill sizes="(min-width: 768px) 35vw, 92vw" className="object-cover" />
                  </div>
                )}
              </Reveal>
            ))}
          </ol>
        )}

        {why.blocks.length > 0 && (
          <section className="grid gap-px overflow-hidden rounded-panel border border-line bg-line md:grid-cols-2" aria-label={t("why.title")}>
            {why.blocks.map((b) => (
              <Reveal key={b.key} className="flex flex-col gap-4 bg-umber-950 p-8 md:p-10">
                <h2 className="eyebrow">{BLOCK_LABELS[b.key][locale]}</h2>
                <p className="whitespace-pre-line text-lg leading-relaxed text-sand">{b.text}</p>
              </Reveal>
            ))}
          </section>
        )}

        {/* Certifications are only rendered when real ones have been entered in the CMS. */}
        {why.certifications.length > 0 && (
          <section aria-labelledby="certs" className="flex flex-col gap-8">
            <h2 id="certs" className="font-display text-heading">{CERT_LABEL[locale]}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {why.certifications.map((c) => (
                <li key={c.name} className="flex items-center gap-4 rounded-panel border border-line p-5">
                  {c.image && (
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-art bg-ivory">
                      <Image src={c.image} alt="" fill sizes="64px" className="object-contain p-1" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-sm text-stone">{[c.issuer, c.year].filter(Boolean).join(" · ")}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/wall-art" size="lg">{t("home.finalCta")} <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden /></ButtonLink>
          <ButtonLink href="/customize" size="lg" variant="outline">{t("home.customCta")}</ButtonLink>
        </div>
      </div>
    </div>
  );
}
