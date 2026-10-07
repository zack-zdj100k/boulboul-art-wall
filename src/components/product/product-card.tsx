"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, type PointerEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/client";
import { formatPrice } from "@/i18n/config";
import { cn } from "@/lib/utils";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  image: { url: string; alt: string } | null;
  hoverImage: { url: string; alt: string } | null;
  fromPrice: number | null;
  originalPrice: number | null;
  hasPromo: boolean;
  framesCount: number;
  allowCustomSize: boolean;
  sizesLabel: string | null;
  isDemo: boolean;
};

/**
 * A product presented as an artwork hung on a wall: full-bleed image, gallery shadow,
 * pointer-driven tilt, slow image zoom, and a caption/CTA that rises on hover
 * (always visible on touch screens).
 */
export function ProductCard({ product, priority = false, sizes = "(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 92vw" }: { product: ProductCardData; priority?: boolean; sizes?: string }) {
  const { t, locale } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !ref.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.setProperty("--ry", `${x * 7}deg`);
    ref.current.style.setProperty("--rx", `${-y * 7}deg`);
    ref.current.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
  };
  const onLeave = () => {
    ref.current?.style.setProperty("--ry", "0deg");
    ref.current?.style.setProperty("--rx", "0deg");
  };

  return (
    <article className="group relative">
      <Link href={`/wall-art/${product.slug}`} className="block rounded-art [perspective:1100px] focus-visible:outline-offset-8" aria-label={`${product.name} — ${product.fromPrice != null ? `${t("common.from")} ${formatPrice(product.fromPrice, locale)}` : t("product.priceOnRequest")}`}>
        <div
          ref={ref}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          className="relative aspect-[4/5] overflow-hidden rounded-art bg-umber-800 shadow-mounted transition-[transform,box-shadow] duration-500 ease-gallery [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] group-hover:-translate-y-1.5 group-hover:shadow-lifted motion-reduce:transform-none"
        >
          {product.image ? (
            <>
              <Image
                src={product.image.url}
                alt={product.image.alt}
                fill
                sizes={sizes}
                preload={priority}
                quality={80}
                className="object-cover transition-transform duration-[1400ms] ease-editorial group-hover:scale-[1.06] motion-reduce:transition-none"
              />
              {product.hoverImage && (
                <Image
                  src={product.hoverImage.url}
                  alt=""
                  aria-hidden
                  fill
                  sizes={sizes}
                  quality={80}
                  className="object-cover opacity-0 transition-opacity duration-700 ease-gallery group-hover:opacity-100 [@media(hover:none)]:hidden"
                />
              )}
            </>
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs uppercase tracking-[0.2em] text-stone">Image à venir</div>
          )}

          {/* LED-like light sweep following the pointer */}
          <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(70%_50%_at_var(--gx,50%)_0%,rgb(250_247_240/0.2),transparent_70%)]" />
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/90 via-night/30 via-40% to-transparent to-65% transition-opacity duration-500 group-hover:from-night" />
          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-art ring-1 ring-inset ring-white/8" />

          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
            <div className="flex flex-wrap gap-1.5">{product.hasPromo && <Badge tone="ember">{t("shop.promo")}</Badge>}</div>
            {product.isDemo && <Badge tone="demo">{t("common.demo")}</Badge>}
          </div>

          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5 text-paper md:p-6">
            {product.category && <p className="eyebrow text-[10px] text-[#c9d3bd]">{product.category}</p>}
            <h3 className="font-display text-[1.45rem] leading-tight text-paper text-balance md:text-[1.6rem]">{product.name}</h3>
            <div className="flex items-end justify-between gap-3">
              {product.fromPrice != null ? (
                <p className="text-sm text-paper/80">
                  <span className="block text-[11px] uppercase tracking-[0.14em] text-paper/65">{t("common.from")}</span>
                  <span className="font-semibold tabular-nums text-paper">{formatPrice(product.fromPrice, locale)}</span>
                  {product.hasPromo && product.originalPrice != null && <s className="ms-2 text-xs text-paper/60 tabular-nums">{formatPrice(product.originalPrice, locale)}</s>}
                </p>
              ) : (
                <p className="text-sm font-semibold text-paper/85">{t("product.priceOnRequest")}</p>
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full bg-paper px-4 py-2 text-xs font-bold text-night transition-all duration-500 ease-editorial",
                  "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100",
                )}
                aria-hidden
              >
                {t("shop.viewProduct")}
                <ArrowUpRight className="size-3.5 rtl:-scale-x-100" />
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-paper/65">
              {product.sizesLabel && <span>{product.sizesLabel}</span>}
              {product.framesCount > 0 && <span>· {t("shop.framesAvailable", { count: product.framesCount })}</span>}
              {product.allowCustomSize && <span>· {t("shop.customSize")}</span>}
            </div>
          </div>
        </div>
        {/* Soft contact shadow on the wall */}
        <span aria-hidden className="pointer-events-none absolute inset-x-[12%] -bottom-5 h-8 rounded-[50%] bg-night/35 blur-2xl transition-opacity duration-500 group-hover:opacity-80" />
      </Link>
    </article>
  );
}
