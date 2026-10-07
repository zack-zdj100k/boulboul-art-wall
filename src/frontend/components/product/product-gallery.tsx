"use client";

import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState, type PointerEvent } from "react";
import { Dialog } from "@/frontend/components/ui/dialog";
import { useI18n } from "@/shared/i18n/client";
import { cn } from "@/shared/lib/utils";

type GalleryImage = { id: string; url: string; alt: string };

export function ProductGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const [hovering, setHovering] = useState(false);
  const current = images[index];

  const go = (delta: number) => setIndex((i) => (i + delta + images.length) % images.length);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
  };

  if (!current) {
    return <div className="grid aspect-[4/5] place-items-center rounded-art bg-umber-800 text-sm text-stone">—</div>;
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row-reverse">
      <div
        className="group relative aspect-[4/5] flex-1 cursor-zoom-in overflow-hidden rounded-art bg-umber-800 shadow-lifted"
        onPointerMove={onMove}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(document.documentElement.dir === "rtl" ? -1 : 1);
          if (e.key === "ArrowLeft") go(document.documentElement.dir === "rtl" ? 1 : -1);
        }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div key={current.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
            <Image
              src={current.url}
              alt={current.alt}
              fill
              preload={index === 0}
              sizes="(min-width: 1024px) 50vw, 100vw"
              quality={90}
              className="object-cover transition-transform duration-300 ease-out"
              style={{ transformOrigin: origin, transform: hovering ? "scale(1.8)" : "scale(1)" }}
            />
          </motion.div>
        </AnimatePresence>
        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          className="absolute end-4 bottom-4 inline-flex items-center gap-2 rounded-full bg-ink/70 px-4 py-2 text-xs font-bold text-ivory backdrop-blur transition hover:bg-ink"
          aria-label={t("product.zoom")}
        >
          <ZoomIn className="size-4" aria-hidden />
          <span className="tabular-nums">
            {index + 1}/{images.length}
          </span>
        </button>
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label={t("common.previous")} className="absolute start-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-ink/60 text-ivory opacity-0 backdrop-blur transition group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
              <ChevronLeft className="size-5 rtl:rotate-180" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label={t("common.next")} className="absolute end-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-ink/60 text-ivory opacity-0 backdrop-blur transition group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
              <ChevronRight className="size-5 rtl:rotate-180" />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <ul className="scrollbar-none flex gap-3 overflow-x-auto md:w-20 md:flex-col md:overflow-visible">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={t("product.imageOf", { index: i + 1, total: images.length })}
                aria-current={i === index}
                className={cn("relative block aspect-[4/5] w-16 overflow-hidden rounded-art ring-2 transition md:w-20", i === index ? "ring-gold" : "ring-transparent opacity-60 hover:opacity-100")}
              >
                <Image src={img.url} alt="" fill sizes="80px" quality={70} className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={zoomOpen} onClose={() => setZoomOpen(false)} title={name} size="full" closeLabel={t("common.close")}>
        <div className="relative h-[80dvh] bg-ink">
          <Image src={current.url} alt={current.alt} fill sizes="100vw" quality={90} className="object-contain" />
        </div>
      </Dialog>
    </div>
  );
}
