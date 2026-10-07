"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/frontend/components/ui/badge";
import { useI18n } from "@/shared/i18n/client";
import { formatPrice } from "@/shared/i18n/config";

export type ProductTileData = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  image: { url: string; alt: string } | null;
  hoverImage: { url: string; alt: string } | null;
  fromPrice: number | null;
  originalPrice: number | null;
  hasPromo: boolean;
  isDemo: boolean;
  swatches: { name: string; color: string }[];
};

/** Clean catalogue tile: image on cream, name, price, frame colour dots. */
export function ProductTile({ product, priority = false }: { product: ProductTileData; priority?: boolean }) {
  const { t, locale } = useI18n();
  return (
    <article className="group">
      <Link href={`/wall-art/${product.slug}`} className="flex flex-col gap-3 rounded-md focus-visible:outline-offset-4">
        <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-umber-800">
          {product.image && (
            <Image
              src={product.image.url}
              alt={product.image.alt}
              fill
              preload={priority}
              sizes="(min-width: 1024px) 23vw, (min-width: 640px) 45vw, 48vw"
              quality={80}
              className="object-cover transition-transform duration-700 ease-editorial group-hover:scale-[1.04]"
            />
          )}
          {product.hoverImage && (
            <Image
              src={product.hoverImage.url}
              alt=""
              aria-hidden
              fill
              sizes="(min-width: 1024px) 23vw, (min-width: 640px) 45vw, 48vw"
              quality={80}
              className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 [@media(hover:none)]:hidden"
            />
          )}
          <div className="absolute inset-x-2 top-2 flex justify-between gap-2">
            <span>{product.hasPromo && <Badge tone="ember">{t("shop.promo")}</Badge>}</span>
            {product.isDemo && <Badge tone="demo">{t("common.demo")}</Badge>}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {product.category && <p className="text-[10px] font-bold tracking-[0.16em] text-stone uppercase">{product.category}</p>}
          <h3 className="text-[13px] leading-snug font-bold tracking-[0.06em] text-ivory uppercase">{product.name}</h3>
          {product.fromPrice != null ? (
            <p className="text-sm tabular-nums">
              <span className="text-stone">{t("common.from")} </span>
              <span className="font-semibold text-ivory">{formatPrice(product.fromPrice, locale)}</span>
              {product.hasPromo && product.originalPrice != null && <s className="ms-2 text-xs text-stone">{formatPrice(product.originalPrice, locale)}</s>}
            </p>
          ) : (
            <p className="text-sm text-stone">{t("product.priceOnRequest")}</p>
          )}
          {product.swatches.length > 0 && (
            <ul className="mt-1 flex gap-1.5" aria-label={t("product.frame")}>
              {product.swatches.map((s) => (
                <li key={s.name} title={s.name} className="size-3 rounded-full ring-1 ring-ivory/15" style={{ background: s.color }}>
                  <span className="sr-only">{s.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Link>
    </article>
  );
}
