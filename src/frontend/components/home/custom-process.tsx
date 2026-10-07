"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { ArrowRight, Lightbulb, Ruler, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/frontend/components/ui/button";
import { cn } from "@/shared/lib/utils";

const STEP_MS = 3200;
const ICONS = [Upload, Ruler, Lightbulb];
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * "Sur mesure" — the three steps of a custom request play one after another (active card
 * lifts, its progress bar fills, the rail advances) while a brand arch draws itself behind.
 * Pauses on hover/focus; static with reduced motion.
 */
export function CustomProcess({
  eyebrow,
  title,
  text,
  steps,
  cta,
}: {
  eyebrow: string;
  title: string;
  text: string;
  steps: readonly string[];
  cta: { label: string; href: string };
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px -20% 0px" });
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const running = inView && !paused && !reduce;

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => setActive((a) => (a + 1) % steps.length), STEP_MS);
    return () => clearTimeout(timer);
  }, [running, active, steps.length]);

  return (
    <div ref={ref} className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
      <div className="flex flex-col gap-6">
        <motion.p initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: EASE }} className="eyebrow">
          {eyebrow}
        </motion.p>
        <motion.h2
          id="custom-title"
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.05, ease: EASE }}
          className="font-display text-title font-light tracking-[-0.02em] text-balance"
        >
          {title}
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.15, ease: EASE }} className="max-w-xl text-lg leading-relaxed text-sand">
          {text}
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.25, ease: EASE }}>
          <ButtonLink href={cta.href} variant="gold" size="lg" className="group">
            {cta.label}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" aria-hidden />
          </ButtonLink>
        </motion.div>
      </div>

      <div className="relative" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
        {/* Brand arch drawing itself, floating gently */}
        <motion.svg
          aria-hidden
          viewBox="0 0 200 260"
          className="pointer-events-none absolute -top-10 end-0 -z-10 h-[115%] w-auto text-gold-soft/45"
          animate={reduce ? undefined : { y: [0, -14, 0], rotate: [0, 1.5, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.path
            d="M20 250V100a80 80 0 0 1 160 0v150"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: reduce ? 1 : 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 2.4, ease: "easeInOut" }}
          />
          <motion.circle cx="100" cy="150" r="7" fill="currentColor" animate={reduce ? undefined : { scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 2.6, repeat: Infinity }} />
        </motion.svg>

        <ol className="relative flex flex-col gap-4 ps-6">
          {/* Rail */}
          <span aria-hidden className="absolute start-0 top-4 bottom-4 w-px bg-line-strong">
            <motion.span
              className="absolute inset-x-0 top-0 block bg-gold"
              animate={{ height: `${reduce ? 100 : ((active + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.7, ease: EASE }}
            />
          </span>
          {steps.map((s, i) => {
            const Icon = ICONS[i] ?? Lightbulb;
            const isActive = reduce || i === active;
            return (
              <motion.li
                key={s}
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.15 + i * 0.12, ease: EASE }}
              >
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-current={i === active ? "step" : undefined}
                  className={cn(
                    "relative flex w-full items-center gap-4 overflow-hidden rounded-panel border p-5 text-start transition-all duration-500 ease-editorial",
                    isActive ? "-translate-y-0.5 border-gold/50 bg-ink shadow-mounted" : "border-line bg-umber-950/60 opacity-70 hover:opacity-100",
                  )}
                >
                  <span aria-hidden className={cn("absolute -start-[31px] top-1/2 size-3 -translate-y-1/2 rounded-full border-2 transition-colors duration-500", isActive ? "border-gold bg-gold" : "border-line-strong bg-ink")} />
                  <motion.span
                    className={cn("grid size-12 shrink-0 place-items-center rounded-full transition-colors duration-500", isActive ? "bg-gold text-paper" : "bg-gold/12 text-gold")}
                    animate={isActive && !reduce ? { rotate: [0, -8, 8, 0], scale: [1, 1.08, 1] } : { rotate: 0, scale: 1 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                  >
                    <Icon className="size-5" aria-hidden />
                  </motion.span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-stone tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-semibold text-ivory">{s}</span>
                  </span>
                  {/* Time remaining on the active step */}
                  {i === active && running && (
                    <motion.span
                      key={`${active}-progress`}
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-gold-soft rtl:origin-right"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: STEP_MS / 1000, ease: "linear" }}
                    />
                  )}
                </button>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
