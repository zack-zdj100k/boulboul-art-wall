"use client";

import gsap from "gsap";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type CollectionItem = { slug: string; name: string; href: string; image: string; count: string };

/** Optimised URL for an SVG <image> (next/image can't render inside SVG). */
function optimised(src: string) {
  return src.startsWith("/") ? `/_next/image?url=${encodeURIComponent(src)}&w=1080&q=80` : src;
}

const SHAPES = ["arches", "gallery", "grid", "triptych"] as const;

/**
 * Collections list on the left; on the right the hovered collection's photo appears through
 * an animated mask made of several shapes (arches, a gallery wall, a grid, a triptych) that
 * pop in, breathe and dissolve in a loop (GSAP).
 */
export function CollectionsShowcase({ items }: { items: CollectionItem[] }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const clipId = (i: number) => `${uid}-${SHAPES[i % SHAPES.length]}`;
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<SVGImageElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const interacted = useRef(false);

  // (Re)build the loop for the active collection.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const id = clipId(active);
      imageRef.current?.setAttribute("href", optimised(items[active].image));
      groupRef.current?.setAttribute("clip-path", `url(#${id})`);
      const paths = root.querySelectorAll(`#${id} .clip-part`);
      if (reduce) {
        gsap.set(paths, { scale: 1, transformOrigin: "50% 50%" });
        return;
      }
      gsap.set(paths, { scale: 0, transformOrigin: "50% 50%" });
      gsap
        .timeline({ repeat: -1, repeatDelay: 0.6 })
        .to(paths, { scale: 1, duration: 0.8, stagger: { amount: 0.4, from: "random" }, ease: "expo.out" })
        .to(paths, { scale: 1.05, duration: 1.5, yoyo: true, repeat: 1, ease: "sine.inOut", stagger: { amount: 0.2, from: "center" } })
        .to(paths, { scale: 0, duration: 0.6, stagger: { amount: 0.3, from: "edges" }, ease: "expo.in" });
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, items]);

  // Touch screens have no hover: cycle through collections until the visitor interacts.
  useEffect(() => {
    if (!window.matchMedia("(hover: none)").matches || items.length < 2) return;
    const timer = setInterval(() => {
      if (!interacted.current) setActive((a) => (a + 1) % items.length);
    }, 5200);
    return () => clearInterval(timer);
  }, [items.length]);

  const select = (i: number) => {
    interacted.current = true;
    setActive(i);
  };

  return (
    <div ref={rootRef} className="grid items-center gap-14 md:grid-cols-2 md:gap-10">
      <nav aria-label="Collections" className="relative z-10">
        <ul className="flex flex-col gap-8 md:gap-12">
          {items.map((item, i) => {
            const isActive = i === active;
            const [first, ...rest] = item.name.split(" ");
            return (
              <li key={item.slug}>
                <Link
                  href={item.href}
                  onPointerEnter={() => select(i)}
                  onFocus={() => select(i)}
                  aria-current={isActive ? "true" : undefined}
                  className="group flex items-start gap-5 outline-none focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-gold md:gap-6"
                >
                  <span className={cn("mt-1 text-xl font-bold tabular-nums transition-all duration-500 md:text-2xl", isActive ? "scale-110 text-gold" : "text-stone/70")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex flex-col gap-2">
                    <span
                      className={cn(
                        "text-4xl leading-[0.88] font-extrabold tracking-tighter uppercase transition-all duration-700 ease-editorial sm:text-5xl lg:text-6xl",
                        isActive ? "translate-x-3 text-ivory rtl:-translate-x-3" : "text-ivory/30 group-hover:text-ivory/60",
                      )}
                    >
                      {first}
                      {rest.length > 0 && (
                        <>
                          <br />
                          {rest.join(" ")}
                        </>
                      )}
                    </span>
                    <span className={cn("text-xs font-semibold text-stone transition-all duration-500", isActive ? "translate-x-3 opacity-100 rtl:-translate-x-3" : "opacity-0")}>
                      {item.count} →
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="relative flex items-center justify-center" aria-hidden>
        <div className="absolute size-[110%] rounded-full bg-gold-soft/20 blur-[100px]" />
        <svg viewBox="0 0 500 500" className="relative z-10 h-auto w-full max-w-[520px] drop-shadow-xl">
          <defs>
            {/* Arched mirrors — the brand's signature silhouette */}
            <clipPath id={`${uid}-arches`}>
              <path className="clip-part" d="M20 480V200a70 70 0 0 1 140 0v280Z" />
              <path className="clip-part" d="M180 480V110a70 70 0 0 1 140 0v370Z" />
              <path className="clip-part" d="M340 480V230a70 70 0 0 1 140 0v250Z" />
              <circle className="clip-part" cx="90" cy="70" r="40" />
              <circle className="clip-part" cx="410" cy="120" r="56" />
            </clipPath>
            {/* A gallery wall */}
            <clipPath id={`${uid}-gallery`}>
              <rect className="clip-part" x="20" y="20" width="200" height="280" rx="12" />
              <rect className="clip-part" x="20" y="320" width="200" height="160" rx="12" />
              <rect className="clip-part" x="240" y="20" width="240" height="140" rx="12" />
              <rect className="clip-part" x="240" y="180" width="110" height="160" rx="12" />
              <rect className="clip-part" x="370" y="180" width="110" height="160" rx="12" />
              <rect className="clip-part" x="240" y="360" width="240" height="120" rx="12" />
            </clipPath>
            {/* A grid of small frames */}
            <clipPath id={`${uid}-grid`}>
              {Array.from({ length: 9 }).map((_, i) => (
                <rect key={i} className="clip-part" x={(i % 3) * 160 + 20} y={Math.floor(i / 3) * 160 + 20} width="140" height="140" rx="4" />
              ))}
            </clipPath>
            {/* A triptych */}
            <clipPath id={`${uid}-triptych`}>
              <rect className="clip-part" x="20" y="90" width="140" height="320" rx="6" />
              <rect className="clip-part" x="180" y="30" width="140" height="440" rx="6" />
              <rect className="clip-part" x="340" y="90" width="140" height="320" rx="6" />
            </clipPath>
          </defs>
          <g ref={groupRef} clipPath={`url(#${clipId(0)})`}>
            <image ref={imageRef} href={optimised(items[0].image)} width="500" height="500" preserveAspectRatio="xMidYMid slice" />
          </g>
        </svg>
      </div>
    </div>
  );
}
