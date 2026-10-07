import "server-only";
import type { FooterData } from "@/components/site/site-footer";
import type { SocialNetwork } from "@/components/site/social-icon";
import type { Locale } from "@/i18n/config";
import { loc, safeHref } from "@/lib/cms-schema";
import { getPublished } from "@/server/services/cms";

export async function getFooterData(locale: Locale): Promise<FooterData> {
  const cms = await getPublished(["footer", "social", "contact", "legal.terms", "legal.privacy", "legal.returns"]);
  const social = (["instagram", "tiktok", "facebook", "youtube", "pinterest"] as SocialNetwork[])
    .map((network) => ({ network, href: safeHref(cms.social[network]) }))
    .filter((s): s is { network: SocialNetwork; href: string } => !!s.href);
  const c = cms.contact;
  return {
    tagline: loc(cms.footer.tagline, locale),
    copyright: loc(cms.footer.copyright, locale),
    social,
    contact: {
      phone: typeof c.phone === "string" ? c.phone.trim() : undefined,
      whatsapp: typeof c.whatsapp === "string" ? c.whatsapp.trim() : undefined,
      email: typeof c.email === "string" ? c.email.trim() : undefined,
      address: loc(c.address, locale) || undefined,
    },
    legal: { terms: !!loc(cms["legal.terms"].body, locale), privacy: !!loc(cms["legal.privacy"].body, locale), returns: !!loc(cms["legal.returns"].body, locale) },
  };
}

/**
 * Where to send a customer who needs a Sur Mesure price: WhatsApp (with a prepared message),
 * then phone, then e-mail from the CMS contact section; the custom-design form otherwise.
 */
export async function getContactHref(message: string) {
  const { contact: c } = await getPublished(["contact"]);
  const wa = typeof c.whatsapp === "string" ? c.whatsapp.replace(/\D/g, "") : "";
  if (wa) return `https://wa.me/${wa}?text=${encodeURIComponent(message)}`;
  const phone = typeof c.phone === "string" ? c.phone.replace(/\s/g, "") : "";
  if (phone) return `tel:${phone}`;
  const email = typeof c.email === "string" ? c.email.trim() : "";
  if (email) return `mailto:${email}?subject=${encodeURIComponent(message)}`;
  return "/customize";
}
