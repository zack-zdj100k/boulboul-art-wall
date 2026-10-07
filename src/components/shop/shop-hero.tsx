"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export type ShopSlide = { image: string; alt: string; name: string; href: string };

const SLIDE_MS = 6000;

/** Full-bleed banner: rotating featured pieces behind a fixed headline. */
export function ShopHero({ slides, anchor }: { slides: ShopSlide[]; anchor: string }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused || slides.length < 2) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [index, paused, reduce, slides.length]);

  const slide = slides[index];

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("shop.title")}
      className="relative isolate h-[min(78svh,640px)] min-h-[460px] overflow-hidden bg-night text-paper"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <AnimatePresence initial={false}>
        {slide && (
          <motion.div
            key={slide.image}
            className="absolute inset-0 -z-10"
            initial={{ opacity: 0, scale: reduce ? 1 : 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <Image src={slide.image} alt={slide.alt} fill preload={index === 0} sizes="100vw" quality={85} className="object-cover object-[50%_35%]" />
          </motion.div>
        )}
      </AnimatePresence>
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-night/80 via-night/35 to-transparent rtl:bg-gradient-to-l" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-night/60 to-transparent" />

      <div className="container-page flex h-full flex-col justify-center gap-7 pt-16">
        <p className="text-xs font-bold tracking-[0.3em] text-paper/75 uppercase">{t("shop.heroEyebrow")}</p>
        <h1 className="max-w-xl text-4xl leading-[1.02] tracking-tight uppercase sm:text-5xl lg:text-6xl">
          <span className="block font-extrabold">{t("shop.heroLine1")}</span>
          <span className="block font-light text-paper/85">{t("shop.heroLine2")}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-5">
          <a href={`#${anchor}`} className="inline-flex h-12 items-center rounded-[4px] bg-paper px-7 text-xs font-extrabold tracking-[0.18em] text-night uppercase transition hover:bg-white">
            {t("shop.discover")}
          </a>
          {slide && (
            <Link href={slide.href} className="text-sm font-semibold text-paper/85 underline-offset-4 hover:underline">
              {slide.name} →
            </Link>
          )}
        </div>
      </div>

      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-7">
          <div className="container-page flex gap-2">
            {slides.map((s, i) => (
              <button
                key={s.image}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={t("shop.slide", { index: i + 1 })}
                aria-current={i === index}
                className="group grid h-6 place-items-center"
              >
                <span className={cn("block h-[3px] rounded-full transition-all duration-500", i === index ? "w-10 bg-paper" : "w-6 bg-paper/40 group-hover:bg-paper/70")} />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
