import "server-only";
import type { HeroFanContent } from "@/frontend/components/home/hero-fan";
import type { Founder } from "@/frontend/components/site/founder-card";
import type { SocialNetwork } from "@/frontend/components/site/social-icon";
import type { Locale } from "@/shared/i18n/config";
import { loc, safeHref, safeImage } from "@/shared/lib/cms-schema";
import { getPublished } from "@/backend/services/cms";

// Resolves published CMS sections into typed, localised, sanitised view models.
// Anything empty is dropped so the public site never shows placeholders.

type Raw = Record<string, unknown>;
const list = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);

export async function getHomeContent(locale: Locale) {
  const cms = await getPublished(["home.hero", "home.intro", "home.quality", "home.cta", "testimonials", "why.page", "about.page"]);
  const h = cms["home.hero"];
  const cta = (label: unknown, href: unknown) => {
    const l = loc(label, locale);
    const u = safeHref(href);
    return l && u ? { label: l, href: u } : null;
  };
  const hero: HeroFanContent = {
    title: loc(h.title, locale) || "Boulboul Art Wall",
    titleLine2Prefix: loc(h.titleLine2Prefix, locale),
    titleHighlight: loc(h.titleHighlight, locale),
    description: loc(h.description, locale),
    socialProof: loc(h.socialProof, locale),
    images: list(h.images)
      .map((im) => ({ src: safeImage(im.image) ?? "", alt: loc(im.alt, locale) }))
      .filter((im) => im.src),
    primary: cta(h.primaryLabel, h.primaryHref),
    secondary: cta(h.secondaryLabel, h.secondaryHref),
  };

  const intro = { title: loc(cms["home.intro"].title, locale), text: loc(cms["home.intro"].text, locale) };
  const q = cms["home.quality"];
  const quality = { eyebrow: loc(q.eyebrow, locale), title: loc(q.title, locale), text: loc(q.text, locale), image: safeImage(q.image) };
  const c = cms["home.cta"];
  const finalCta = { title: loc(c.title, locale), text: loc(c.text, locale), button: cta(c.buttonLabel, c.buttonHref), image: safeImage(c.image) };
  const tm = cms.testimonials;
  const testimonials = { eyebrow: loc(tm.eyebrow, locale), title: loc(tm.title, locale), subtitle: loc(tm.subtitle, locale) };
  const why = resolveWhy(cms["why.page"], locale);
  const about = resolveAbout(cms["about.page"], locale);
  return { hero, intro, quality, finalCta, testimonials, why, about };
}

function resolveWhy(w: Raw, locale: Locale) {
  return {
    title: loc(w.title, locale),
    intro: loc(w.intro, locale),
    pillars: list(w.pillars)
      .map((p) => ({ title: loc(p.title, locale), text: loc(p.text, locale), image: safeImage(p.image) }))
      .filter((p) => p.title && p.text),
    blocks: (["materials", "production", "guarantees", "pricing"] as const)
      .map((key) => ({ key, text: loc(w[key], locale) }))
      .filter((b) => b.text),
    certifications: list(w.certifications)
      .map((c) => ({ name: typeof c.name === "string" ? c.name.trim() : "", issuer: typeof c.issuer === "string" ? c.issuer : "", year: typeof c.year === "string" ? c.year : "", image: safeImage(c.image) }))
      .filter((c) => c.name),
  };
}

function resolveAbout(a: Raw, locale: Locale) {
  const founders: Founder[] = list(a.founders)
    .map((f) => ({
      name: typeof f.name === "string" ? f.name.trim() : "",
      role: loc(f.role, locale),
      bio: loc(f.bio, locale),
      photo: safeImage(f.photo),
      links: (["instagram", "tiktok", "facebook", "linkedin"] as SocialNetwork[])
        .map((network) => ({ network, href: safeHref(f[network]) }))
        .filter((l): l is { network: SocialNetwork; href: string } => !!l.href),
    }))
    .filter((f) => f.name);
  return { title: loc(a.title, locale), intro: loc(a.intro, locale), story: loc(a.story, locale), storyImage: safeImage(a.storyImage), founders };
}

export async function getWhyContent(locale: Locale) {
  const cms = await getPublished(["why.page"]);
  return resolveWhy(cms["why.page"], locale);
}

export async function getAboutContent(locale: Locale) {
  const cms = await getPublished(["about.page"]);
  return resolveAbout(cms["about.page"], locale);
}

export async function getLegal(key: "legal.terms" | "legal.privacy" | "legal.returns", locale: Locale) {
  const cms = await getPublished([key]);
  return loc(cms[key].body, locale);
}
