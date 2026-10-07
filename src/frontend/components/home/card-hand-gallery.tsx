"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { useMediaQuery } from "@/frontend/hooks/use-media-query";
import { cn } from "@/shared/lib/utils";

export type FanCardItem = {
  id: string;
  src: string;
  title: string;
  description?: string;
  href?: string;
};

/** Flick speed (px/s) that selects a card regardless of distance travelled. */
const SELECT_VELOCITY = -600;
/** Cards waiting in the hand ride smaller behind the active one. */
const HAND_SCALE = 0.72;

/** Spread each card into a symmetric arc around the middle of the hand. */
function fanTransform(index: number, count: number, spacing: number) {
  const offset = index - (count - 1) / 2;
  const stepDeg = count > 1 ? Math.min(9, 46 / (count - 1)) : 0; // constant total sweep
  const rotate = offset * stepDeg;
  return { rotate, x: offset * spacing, y: Math.abs(rotate) * 1.9 };
}

/**
 * "La galerie": a hand of cards. The active piece is held up; click a card (or drag/flick it
 * upward on desktop) to draw it. Keyboard: Tab focuses a card, Enter/Space draws it.
 */
export function CardHandGallery({
  cards,
  cardWidth = 230,
  className,
  ctaLabel,
  counterLabel,
}: {
  cards: readonly FanCardItem[];
  cardWidth?: number;
  className?: string;
  ctaLabel: string;
  counterLabel?: string;
}) {
  const reduce = useReducedMotion();
  const fanRef = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef(false); // ignore the click that ends a drag
  const [fanWidth, setFanWidth] = React.useState<number | null>(null);
  const [activeId, setActiveId] = React.useState(cards[0]?.id);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  // Dragging claims the vertical axis, so on touch screens it would block page scrolling.
  const canDrag = useMediaQuery("(pointer: fine)");

  const activeIndex = Math.max(0, cards.findIndex((c) => c.id === activeId));
  const activeCard = cards[activeIndex];

  React.useEffect(() => {
    const node = fanRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setFanWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Every distance scales off the card so the fan holds together at any width.
  const width = fanWidth === null ? cardWidth : Math.min(cardWidth, fanWidth * 0.55);
  const height = width * 1.4;
  const baseBottom = height * 0.09;
  const hoverLift = height * 0.34;
  const activeLift = height * 0.62;
  const selectDistance = -height * 0.5;

  const handCards = cards.filter((c) => c.id !== activeCard?.id);
  const hoveredIndex = hoveredId ? handCards.findIndex((c) => c.id === hoveredId) : -1;
  const maxOffset = (handCards.length - 1) / 2;
  const halfAvailable = fanWidth === null ? Number.POSITIVE_INFINITY : fanWidth / 2 - width * 0.45;
  const fanSpacing = maxOffset > 0 ? Math.min(width * (handCards.length > 5 ? 0.43 : 0.52), Math.max(width * 0.23, halfAvailable / maxOffset)) : 0;

  const cardTransition = reduce ? { duration: 0.16, ease: "easeOut" as const } : { type: "spring" as const, damping: 30, mass: 0.9, stiffness: 340 };
  const textTransition = { duration: reduce ? 0 : 0.32 };
  const textOffset = reduce ? 0 : 10;

  const clearHover = (id: string) => setHoveredId((h) => (h === id ? null : h));
  const selectCard = (card: FanCardItem) => {
    if (card.id === activeCard?.id) return;
    clearHover(card.id);
    setActiveId(card.id);
  };

  return (
    <div className={cn("flex w-full flex-col items-center gap-6 sm:flex-row sm:gap-6 lg:gap-10", className)}>
      <div className="w-full shrink-0 text-center sm:w-40 sm:text-end md:w-48 lg:w-60">
        {activeCard && (
          <motion.div key={activeCard.id} initial={{ opacity: 0, y: textOffset }} animate={{ opacity: 1, y: 0 }} transition={textTransition}>
            <p className="text-xs text-stone tabular-nums" aria-label={counterLabel}>
              {String(activeIndex + 1).padStart(2, "0")} / {String(cards.length).padStart(2, "0")}
            </p>
            <h3 className="mt-2 font-display text-2xl leading-tight text-balance text-ivory lg:text-3xl">{activeCard.title}</h3>
          </motion.div>
        )}
      </div>

      {/* The fan keeps the same geometry in both reading directions. */}
      <div ref={fanRef} dir="ltr" className="relative w-full min-w-0 flex-1" style={{ minHeight: height * 1.78 }}>
        {cards.map((card) => {
          const isActive = card.id === activeCard?.id;
          const handIndex = handCards.findIndex((c) => c.id === card.id);
          // Outer layer = resting slot (hover hit area); inner layer = hover lift.
          let slot: { rotate: number; scale: number; x: number; y: number };
          let lift = { rotate: 0, scale: 1, x: 0, y: 0 };
          let zIndex: number;

          if (isActive) {
            slot = { rotate: 0, scale: 1, x: 0, y: -activeLift };
            zIndex = 100;
          } else {
            const fan = fanTransform(handIndex, handCards.length, fanSpacing);
            const isHovered = card.id === hoveredId;
            const neighborShift =
              hoveredIndex !== -1 && !isHovered ? (Math.sign(handIndex - hoveredIndex) * width * 0.14) / Math.max(1, Math.abs(handIndex - hoveredIndex)) : 0;
            const dx = neighborShift;
            const dy = isHovered ? -hoverLift - fan.y : 0;
            const rad = (-fan.rotate * Math.PI) / 180; // map screen offset into the slot's rotated frame
            slot = { rotate: fan.rotate, scale: HAND_SCALE, x: fan.x, y: fan.y };
            lift = {
              rotate: isHovered ? -fan.rotate * 0.45 : 0,
              scale: isHovered ? 1.08 : 1,
              x: (dx * Math.cos(rad) - dy * Math.sin(rad)) / HAND_SCALE,
              y: (dx * Math.sin(rad) + dy * Math.cos(rad)) / HAND_SCALE,
            };
            // The card under the pointer comes to the very front — above the card being shown.
            zIndex = isHovered ? 120 : 10 + handIndex;
          }

          return (
            <motion.div
              key={card.id}
              className="absolute left-1/2"
              initial={false}
              animate={slot}
              transition={cardTransition}
              onHoverStart={() => !isActive && setHoveredId(card.id)}
              onHoverEnd={() => clearHover(card.id)}
              style={{ bottom: baseBottom, marginLeft: -width / 2, zIndex }}
            >
              <motion.div initial={false} animate={lift} transition={cardTransition}>
                <motion.button
                  type="button"
                  aria-label={card.title}
                  aria-pressed={isActive}
                  className={cn(
                    "block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold",
                    isActive ? "cursor-default" : "cursor-grab active:cursor-grabbing",
                  )}
                  drag={canDrag && !isActive ? "y" : false}
                  dragConstraints={{ bottom: 0, top: -height * 1.65 }}
                  dragElastic={0.12}
                  dragSnapToOrigin
                  onPointerDown={() => (draggingRef.current = false)}
                  onDragStart={() => (draggingRef.current = true)}
                  onDragEnd={(_e, info) => {
                    if (info.offset.y < selectDistance || info.velocity.y < SELECT_VELOCITY) selectCard(card);
                  }}
                  onClick={() => {
                    if (draggingRef.current) {
                      draggingRef.current = false;
                      return;
                    }
                    selectCard(card);
                  }}
                  onFocus={() => !isActive && setHoveredId(card.id)}
                  onBlur={() => clearHover(card.id)}
                >
                  <span className="relative block overflow-hidden rounded-xl border border-line bg-umber-800 shadow-lifted" style={{ width, height }}>
                    <Image src={card.src} alt="" fill sizes="260px" quality={80} draggable={false} className="pointer-events-none object-cover select-none" />
                  </span>
                </motion.button>
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      <div aria-live="polite" className="w-full shrink-0 text-center sm:w-40 sm:text-start md:w-48 lg:w-60">
        {activeCard && (
          <motion.div key={activeCard.id} initial={{ opacity: 0, y: textOffset }} animate={{ opacity: 1, y: 0 }} transition={textTransition} className="flex flex-col items-center gap-4 sm:items-start">
            {activeCard.description && <p className="text-sm leading-relaxed text-pretty text-sand">{activeCard.description}</p>}
            {activeCard.href && (
              <Link href={activeCard.href} className="inline-flex items-center gap-1.5 text-sm font-bold text-gold hover:underline">
                {ctaLabel}
                <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
              </Link>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
