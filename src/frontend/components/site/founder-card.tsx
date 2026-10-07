"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { SocialIcon, type SocialNetwork } from "./social-icon";

export type Founder = { name: string; role: string; bio: string; photo: string | null; links: { network: SocialNetwork; href: string }[] };

/** Team-01 language: large portrait, desaturated at rest, colour and scale on hover/focus. */
export function FounderCard({ founder, index }: { founder: Founder; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.8, delay: index * 0.12, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="group flex flex-col gap-6"
      tabIndex={0}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-art bg-umber-800 shadow-mounted">
        {founder.photo ? (
          <Image
            src={founder.photo}
            alt={founder.name}
            fill
            sizes="(min-width: 768px) 45vw, 92vw"
            className="object-cover grayscale-[0.9] transition-[filter,transform] duration-[900ms] ease-editorial group-hover:scale-[1.04] group-hover:grayscale-0 group-focus-visible:grayscale-0"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center font-display text-7xl text-umber-600">{founder.name.slice(0, 1)}</div>
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-night/70 via-transparent to-transparent opacity-70 transition-opacity duration-700 group-hover:opacity-40" />
        <span className="absolute start-5 top-5 font-display text-sm text-paper/80 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="font-display text-3xl font-light">{founder.name}</h3>
          {founder.role && <p className="eyebrow mt-2 text-[10px]">{founder.role}</p>}
        </div>
        {founder.bio && <p className="max-w-prose whitespace-pre-line leading-relaxed text-sand">{founder.bio}</p>}
        {founder.links.length > 0 && (
          <ul className="flex gap-2">
            {founder.links.map((l) => (
              <li key={l.network}>
                <a href={l.href} target="_blank" rel="noopener noreferrer" aria-label={`${founder.name} — ${l.network}`} className="grid size-10 place-items-center rounded-full border border-line text-sand transition hover:border-gold/60 hover:text-gold">
                  <SocialIcon network={l.network} className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.article>
  );
}
