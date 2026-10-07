"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue, type Variants } from "motion/react";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { ButtonLink } from "@/frontend/components/ui/button";
import { cn } from "@/shared/lib/utils";

export type HeroFanContent = {
  title: string;
  titleLine2Prefix: string;
  titleHighlight: string;
  description: string;
  socialProof: string;
  images: { src: string; alt: string }[];
  primary: { label: string; href: string } | null;
  secondary: { label: string; href: string } | null;
};

const EASE = [0.22, 1, 0.36, 1] as const;

// Three cards fanned out: the centre one raised, the sides tucked behind and tilted.
// `depth` drives the pointer parallax, `float` the idle drift (different per card).
const fanSlots = [
  { width: "w-[38%]", layout: "-mr-8 z-10", rotate: -6, x: 48, y: 24, depth: 0.6, float: { y: 10, r: -1.4, d: 6.4 } },
  { width: "w-[42%]", layout: "z-20", rotate: 0, x: 0, y: -8, depth: 1, float: { y: 14, r: 0.8, d: 5.2 } },
  { width: "w-[38%]", layout: "-ml-8 z-10", rotate: 6, x: -48, y: 24, depth: 0.6, float: { y: 9, r: 1.4, d: 7.1 } },
];
type Slot = (typeof fanSlots)[number];

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: EASE } },
};

const fanContainer: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: EASE, delay: 0.4, delayChildren: 0.5, staggerChildren: 0.1 },
  },
};

// Cards start stacked toward the centre, then slide out into the fan.
const fanCard: Variants = {
  hidden: (slot: Slot) => ({ x: slot.x, rotate: slot.rotate, y: slot.y }),
  visible: (slot: Slot) => ({ x: 0, rotate: slot.rotate, y: slot.y, transition: { duration: 0.5, ease: EASE } }),
};

/** One card: entrance slot → idle float → pointer parallax → hover lift. */
function FanCard({ slot, img, index, mx, my, reduce }: { slot: Slot; img: { src: string; alt: string }; index: number; mx: MotionValue<number>; my: MotionValue<number>; reduce: boolean }) {
  const px = useTransform(mx, (v) => v * 26 * slot.depth);
  const py = useTransform(my, (v) => v * 18 * slot.depth);
  const tilt = useTransform(mx, (v) => v * 4 * slot.depth);
  return (
    <motion.div custom={slot} variants={fanCard} className={cn("relative shrink-0", slot.width, slot.layout)}>
      <motion.div
        animate={reduce ? undefined : { y: [0, -slot.float.y, 0], rotate: [0, slot.float.r, 0] }}
        transition={{ duration: slot.float.d, repeat: Infinity, ease: "easeInOut", delay: 1.2 + index * 0.4 }}
      >
        <motion.div style={reduce ? undefined : { x: px, y: py, rotateY: tilt }}>
          <motion.div
            whileHover={reduce ? undefined : { y: -18, scale: 1.04, rotate: -slot.rotate * 0.5 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="relative aspect-[4/5] overflow-hidden rounded-xl bg-umber-800 shadow-lifted outline outline-ivory/10"
          >
            <Image src={img.src} alt={img.alt} fill preload={index === 1} sizes="(min-width: 768px) 320px, 42vw" quality={85} className="object-cover" />
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

const LEDE_START = 0.55; // after the title has settled
const WORD_STEP = 0.035;

/**
 * Hero paragraph: a hairline with a sage diamond draws itself, then the words settle one by one
 * (soft blur → sharp, like ink on paper). The part before "—" is the lead: deeper ink and a sage
 * underline that sweeps in once the words are in place. Screen readers get the plain sentence.
 */
function HeroLede({ text, animate }: { text: string; animate: boolean }) {
  const [lead, rest] = text.includes("—") ? [text.slice(0, text.indexOf("—")).trim(), text.slice(text.indexOf("—") + 1).trim()] : ["", text];
  const leadWords = lead ? lead.split(/\s+/) : [];
  const restWords = rest.split(/\s+/).filter(Boolean);
  const total = leadWords.length + restWords.length + (lead ? 1 : 0);
  const underlineDelay = LEDE_START + (leadWords.length + 1) * WORD_STEP + 0.35;

  const word = (w: string, i: number, className?: string) => (
    <motion.span
      key={i}
      className={cn("inline-block will-change-[filter,transform,opacity]", className)}
      initial={animate ? { opacity: 0, y: 10, filter: "blur(6px)" } : false}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ delay: LEDE_START + i * WORD_STEP, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      {w}
    </motion.span>
  );
  const withSpaces = (words: string[], offset: number, className?: string) =>
    words.flatMap((w, i) => [word(w, offset + i, className), i < words.length - 1 ? " " : null]);

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-5">
      {/* Hairline + diamond */}
      <div aria-hidden className="flex w-40 items-center gap-2">
        <motion.span
          className="h-px flex-1 origin-right bg-gradient-to-l from-gold-soft/70 to-transparent"
          initial={animate ? { scaleX: 0 } : false}
          animate={{ scaleX: 1 }}
          transition={{ delay: LEDE_START - 0.2, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.span
          className="size-1.5 rotate-45 bg-gold-soft"
          initial={animate ? { scale: 0, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: LEDE_START - 0.3, duration: 0.5, ease: "backOut" }}
        />
        <motion.span
          className="h-px flex-1 origin-left bg-gradient-to-r from-gold-soft/70 to-transparent"
          initial={animate ? { scaleX: 0 } : false}
          animate={{ scaleX: 1 }}
          transition={{ delay: LEDE_START - 0.2, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <p className="text-[15px] leading-[1.8] text-balance text-sand [--lede-from:left] rtl:[--lede-from:right] sm:text-[17px]">
        <span className="sr-only">{text}</span>
        <span aria-hidden>
          {lead && (
            <>
              {/* Sage underline drawn under the lead once it is written — follows the text across line breaks. */}
              <motion.span
                className="font-medium text-ivory [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                style={{
                  backgroundImage: "linear-gradient(90deg, rgb(138 154 123 / 0.15), rgb(138 154 123 / 0.9))",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "var(--lede-from, left) 100%",
                  paddingBottom: 3,
                }}
                initial={animate ? { backgroundSize: "0% 2px" } : false}
                animate={{ backgroundSize: "100% 2px" }}
                transition={{ delay: underlineDelay, duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
              >
                {withSpaces(leadWords, 0)}
              </motion.span>{" "}
              {word("—", leadWords.length, "text-gold-soft")}{" "}
            </>
          )}
          {withSpaces(restWords, total - restWords.length)}
        </span>
      </p>
    </div>
  );
}

/** Home hero: centred editorial title, CTAs, and a fan of three artworks that keeps moving. */
export function HeroFan({ content }: { content: HeroFanContent }) {
  const reduce = !!useReducedMotion();
  const animate = !reduce;
  // Pointer position over the fan, normalised to -0.5..0.5 and smoothed.
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const mx = useSpring(rawX, { stiffness: 80, damping: 18 });
  const my = useSpring(rawY, { stiffness: 80, damping: 18 });
  const hasLine2 = content.titleLine2Prefix || content.titleHighlight;

  return (
    <section id="hero" aria-labelledby="hero-title" className="relative isolate w-full overflow-hidden bg-ink">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70%] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(138_154_123/0.16),transparent_70%)]" />
      <motion.div
        className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 pt-[calc(72px+3rem)] pb-20 text-center sm:gap-10 sm:pt-[calc(72px+4.5rem)] sm:pb-28"
        variants={animate ? container : undefined}
        initial={animate ? "hidden" : false}
        animate={animate ? "visible" : undefined}
      >
        <motion.div variants={animate ? item : undefined} className="flex w-full max-w-3xl flex-col items-center gap-5">
          <h1 id="hero-title" className="font-display text-4xl font-normal tracking-tight text-balance text-ivory sm:text-5xl md:text-6xl">
            {content.title}
            {hasLine2 && (
              <>
                <br />
                {content.titleLine2Prefix && <span>{content.titleLine2Prefix} </span>}
                {content.titleHighlight && <span className="text-gold italic">{content.titleHighlight}</span>}
              </>
            )}
          </h1>
          {content.description && <HeroLede text={content.description} animate={animate} />}
        </motion.div>

        {(content.primary || content.secondary || content.socialProof) && (
          <motion.div variants={animate ? item : undefined} className="flex flex-col items-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
              {content.primary && (
                <ButtonLink href={content.primary.href}>
                  {content.primary.label}
                  <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
                </ButtonLink>
              )}
              {content.secondary && (
                <ButtonLink href={content.secondary.href} variant="outline">
                  {content.secondary.label}
                </ButtonLink>
              )}
            </div>
            {content.socialProof && <p className="text-xs font-medium text-stone">{content.socialProof}</p>}
          </motion.div>
        )}

        {content.images.length > 0 && (
          <div className="mx-auto w-full max-w-3xl">
            {/* The fan is pure imagery: keep the same composition in Arabic (RTL). */}
            <motion.div
              dir="ltr"
              className="relative flex w-full items-center justify-center"
              variants={fanContainer}
              initial={animate ? "hidden" : false}
              animate="visible"
              style={{ perspective: 1200 }}
              onPointerMove={(e) => {
                if (e.pointerType !== "mouse") return;
                const r = e.currentTarget.getBoundingClientRect();
                rawX.set((e.clientX - r.left) / r.width - 0.5);
                rawY.set((e.clientY - r.top) / r.height - 0.5);
              }}
              onPointerLeave={() => {
                rawX.set(0);
                rawY.set(0);
              }}
            >
              {content.images.slice(0, 3).map((img, i) => (
                <FanCard key={img.src + i} slot={fanSlots[i] ?? fanSlots[1]} img={img} index={i} mx={mx} my={my} reduce={reduce} />
              ))}
            </motion.div>
          </div>
        )}
      </motion.div>
    </section>
  );
}
