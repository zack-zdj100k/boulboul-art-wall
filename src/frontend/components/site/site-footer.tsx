"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/shared/i18n/client";
import { BrandMark } from "./brand";
import { NAV } from "./site-header";
import { SocialIcon, type SocialNetwork } from "./social-icon";

export type FooterData = {
  tagline: string;
  copyright: string;
  social: { network: SocialNetwork; href: string }[];
  contact: { phone?: string; email?: string; address?: string; whatsapp?: string };
  legal: { terms: boolean; privacy: boolean; returns: boolean };
};

const EASE = [0.16, 1, 0.3, 1] as const;

/** Footer-01 language: centred brand, centred navigation, drawn divider, sequential social reveal. */
export function SiteFooter({ data }: { data: FooterData }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const year = new Date().getFullYear();
  const fade = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.7, delay, ease: EASE } };

  const hasContact = data.contact.phone || data.contact.email || data.contact.address || data.contact.whatsapp;

  return (
    <footer id="pied-de-page" className="grain relative overflow-hidden border-t border-line bg-umber-950">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(138_154_123/0.16),transparent)]" />
      <div className="container-page relative flex flex-col items-center gap-12 pt-20 pb-10 text-center md:pt-28">
        <motion.div {...fade(0)} className="flex flex-col items-center gap-5">
          <BrandMark className="h-12 text-gold" />
          <p className="font-display text-[clamp(2.2rem,6vw,4.5rem)] font-light leading-none tracking-[0.08em]" dir="ltr">
            BOULBOUL <span className="text-gold">ART WALL</span>
          </p>
          {data.tagline && <p className="max-w-md whitespace-pre-line font-display text-lg italic text-sand md:text-xl">{data.tagline}</p>}
        </motion.div>

        <motion.nav {...fade(0.1)} aria-label={t("footer.navigation")}>
          <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm font-semibold text-sand transition-colors hover:text-ivory">
                  {t(item.key)}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/account" className="text-sm font-semibold text-sand transition-colors hover:text-ivory">
                {t("nav.account")}
              </Link>
            </li>
          </ul>
        </motion.nav>

        {data.social.length > 0 && (
          <ul aria-label={t("footer.social")} className="flex items-center gap-3">
            {data.social.map((s, i) => (
              <motion.li key={s.network} {...(reduce ? {} : { initial: { opacity: 0, scale: 0.6 }, whileInView: { opacity: 1, scale: 1 }, viewport: { once: true }, transition: { delay: 0.2 + i * 0.08, duration: 0.5, ease: EASE } })}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.network}
                  className="grid size-11 place-items-center rounded-full border border-line text-sand transition hover:-translate-y-0.5 hover:border-gold/60 hover:text-gold"
                >
                  <SocialIcon network={s.network} />
                </a>
              </motion.li>
            ))}
          </ul>
        )}

        {hasContact && (
          <motion.address {...fade(0.15)} className="flex flex-col items-center gap-1.5 text-sm not-italic text-sand md:flex-row md:gap-6">
            {data.contact.phone && <ContactLink href={`tel:${data.contact.phone.replace(/\s/g, "")}`}>{data.contact.phone}</ContactLink>}
            {data.contact.whatsapp && <ContactLink href={`https://wa.me/${data.contact.whatsapp.replace(/\D/g, "")}`}>WhatsApp</ContactLink>}
            {data.contact.email && <ContactLink href={`mailto:${data.contact.email}`}>{data.contact.email}</ContactLink>}
            {data.contact.address && <span className="whitespace-pre-line">{data.contact.address}</span>}
          </motion.address>
        )}

        {/* Animated divider */}
        <div className="relative h-px w-full overflow-hidden bg-line">
          <motion.span
            aria-hidden
            className="absolute inset-y-0 start-0 w-full origin-left bg-gradient-to-r from-transparent via-gold to-transparent rtl:origin-right"
            initial={reduce ? false : { scaleX: 0, opacity: 0 }}
            whileInView={{ scaleX: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, ease: EASE }}
          />
        </div>

        <div className="flex w-full flex-col items-center justify-between gap-4 text-xs text-stone md:flex-row">
          <p>
            © {year} {data.copyright || "Boulboul Art Wall"}. {t("footer.rights")}
          </p>
          {(data.legal.terms || data.legal.privacy || data.legal.returns) && (
            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2">
              {data.legal.terms && (
                <li>
                  <Link href="/legal/terms" className="hover:text-ivory">
                    {t("footer.terms")}
                  </Link>
                </li>
              )}
              {data.legal.privacy && (
                <li>
                  <Link href="/legal/privacy" className="hover:text-ivory">
                    {t("footer.privacy")}
                  </Link>
                </li>
              )}
              {data.legal.returns && (
                <li>
                  <Link href="/legal/returns" className="hover:text-ivory">
                    {t("footer.returns")}
                  </Link>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}

function ContactLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="transition-colors hover:text-ivory" dir="ltr">
      {children}
    </a>
  );
}
