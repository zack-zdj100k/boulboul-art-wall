"use client";

import { motion, useReducedMotion } from "motion/react";
import { Fragment } from "react";
import { Stars } from "@/frontend/components/ui/stars";
import { initials } from "@/shared/lib/utils";

export type Testimonial = { id: string; authorName: string; rating: number; comment: string; product: string | null };
/** A visual repeat of a review (hidden from screen readers so each review is read once). */
type Shown = Testimonial & { repeat?: boolean };

function TestimonialCard({ r, hidden = false }: { r: Testimonial; hidden?: boolean }) {
  return (
    <figure aria-hidden={hidden || undefined} className="w-full rounded-panel border border-line bg-umber-900/80 p-7 shadow-mounted">
      <Stars value={r.rating} label={`${r.rating}/5`} />
      <blockquote className="mt-4 text-[15px] leading-relaxed text-sand">“{r.comment}”</blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <span aria-hidden className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-gold to-umber-600 text-xs font-bold text-paper">
          {initials(r.authorName)}
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-ivory">{r.authorName}</span>
          {r.product && <span className="text-xs text-stone">{r.product}</span>}
        </span>
      </figcaption>
    </figure>
  );
}

function Column({ items, duration, className }: { items: Shown[]; duration: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div className={className}>
        <div className="flex flex-col gap-6">
          {items.map((r) => (
            <TestimonialCard key={r.id} r={r} hidden={r.repeat} />
          ))}
        </div>
      </div>
    );
  }
  // The list is rendered twice and translated by -50% for a seamless loop; the copy is aria-hidden.
  return (
    <div className={className}>
      <motion.div animate={{ translateY: "-50%" }} transition={{ duration, repeat: Infinity, ease: "linear", repeatType: "loop" }} className="flex flex-col gap-6 pb-6">
        {[0, 1].map((copy) => (
          <Fragment key={copy}>
            {items.map((r) => (
              <TestimonialCard key={`${copy}-${r.id}`} r={r} hidden={copy === 1 || r.repeat} />
            ))}
          </Fragment>
        ))}
      </motion.div>
    </div>
  );
}

/** Repeat a short list so every column is full enough to loop smoothly (KING 253 style). */
function fill(items: Testimonial[], min: number, shift: number, allRepeats: boolean): Shown[] {
  if (!items.length) return [];
  const rotated = [...items.slice(shift % items.length), ...items.slice(0, shift % items.length)];
  const out: Testimonial[] = [];
  while (out.length < Math.max(min, rotated.length)) out.push(...rotated);
  return out.map((r, i) => ({ ...r, id: `${r.id}:${i}`, repeat: allRepeats || i >= rotated.length }));
}

/**
 * Review columns that keep moving up and fade away at the top (then come back from the bottom),
 * at different speeds — like KING 253. Real, approved reviews only; a short list is repeated.
 */
export function TestimonialsColumns({ items }: { items: Testimonial[] }) {
  if (!items.length) return null;
  const third = Math.ceil(items.length / 3);
  const distinct = items.length >= 6;
  const split = distinct ? [items.slice(0, third), items.slice(third, third * 2), items.slice(third * 2)] : [items, items, items];
  // With few reviews every column shows the same ones (offset); only the first column is read aloud.
  const cols = split.map((col, i) => fill(col.length ? col : items, 4, i, !distinct && i > 0));
  return (
    <div className="flex max-h-[740px] justify-center gap-6 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)]">
      <Column items={cols[0]} duration={18} className="w-full max-w-sm" />
      <Column items={cols[1]} duration={23} className="hidden w-full max-w-sm md:block" />
      <Column items={cols[2]} duration={20} className="hidden w-full max-w-sm lg:block" />
    </div>
  );
}
