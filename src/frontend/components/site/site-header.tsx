"use client";

import { AnimatePresence, motion } from "motion/react";
import { Menu, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/shared/i18n/client";
import { cn } from "@/shared/lib/utils";
import { CartBadge } from "@/frontend/components/cart/cart-view";
import { Wordmark } from "./brand";
import { LanguageSwitcher } from "./language-switcher";

type HeaderUser = { fullName: string; role: "ADMIN" | "CUSTOMER" } | null;

export const NAV = [
  { href: "/", key: "nav.home" },
  { href: "/wall-art", key: "nav.wallArt" },
  { href: "/customize", key: "nav.customize" },
  { href: "/about", key: "nav.about" },
  { href: "/why-boulboul", key: "nav.why" },
] as const;

export function SiteHeader({ user }: { user: HeaderUser }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  // Hide while scrolling down, reveal on scroll up (and always at the top of the page).
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 80) setHidden(false);
      else if (y > last + 6) setHidden(true);
      else if (y < last - 6) setHidden(false);
      last = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lets other sticky elements (e.g. the shop filters) follow the header.
  useEffect(() => {
    document.documentElement.dataset.header = hidden && !open ? "hidden" : "shown";
  }, [hidden, open]);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <a href="#main" className="sr-only z-[200] rounded-full bg-ivory px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:start-4 focus:top-4">
        {t("nav.skip")}
      </a>
      <header
        data-site-header=""
        onFocusCapture={() => setHidden(false)}
        className={cn(
          // `translate` (not `transform`) so it composes with the intro animation on the header.
          // No bar: only the logo and the two icons float over the page.
          "pointer-events-none fixed inset-x-0 top-0 z-50 transition-[translate] duration-500 ease-gallery",
          hidden && !open && "-translate-y-[120%]",
        )}
      >
        <div className="container-page flex h-[72px] items-center justify-between gap-6">
          {/* Small frosted backings keep the logo legible over photos and content. */}
          <div className={cn("pointer-events-auto -ms-3 rounded-full px-3 py-1.5 transition-[background-color,box-shadow,backdrop-filter] duration-500", !open && "bg-ink/80 shadow-[0_6px_24px_-12px_rgb(37_37_34/0.35)] backdrop-blur-md")}>
            <Wordmark />
          </div>

          <div className={cn("pointer-events-auto flex items-center gap-1 rounded-full p-1 transition-[background-color,box-shadow,backdrop-filter] duration-500", !open && "bg-ink/80 shadow-[0_6px_24px_-12px_rgb(37_37_34/0.35)] backdrop-blur-md")}>
            <CartBadge label={t("cart.title")} />
            <Link
              href="/account"
              className="grid size-10 place-items-center rounded-full text-sand transition hover:bg-ivory/8 hover:text-ivory"
              aria-label={user ? `${t("nav.account")} — ${user.fullName}` : t("nav.account")}
            >
              <User className="size-[18px]" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="grid size-10 place-items-center rounded-full text-ivory hover:bg-ivory/8"
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? t("nav.close") : t("nav.menu")}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="site-menu"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.menu")}
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
            className="fixed inset-0 z-40 flex flex-col bg-umber-950 pt-28 pb-10"
          >
            <nav aria-label={t("nav.menu")} className="container-page flex flex-1 flex-col gap-1">
              {NAV.map((item, i) => (
                <motion.div key={item.href} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.05, duration: 0.5 }}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn("block py-2 font-display text-[clamp(2rem,6vw,4.25rem)] leading-tight transition-colors hover:text-ivory", isActive(item.href) ? "text-ivory" : "text-ivory/50")}
                  >
                    {t(item.key)}
                  </Link>
                </motion.div>
              ))}
              {user?.role === "ADMIN" && (
                <Link href="/admin" onClick={() => setOpen(false)} className="mt-4 text-sm font-bold text-gold">
                  {t("nav.admin")} →
                </Link>
              )}
            </nav>
            <div className="container-page">
              <LanguageSwitcher variant="full" className="w-fit" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
