import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

export function Section({ id, className, children, labelledBy }: { id?: string; className?: string; children: ReactNode; labelledBy?: string }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("relative py-20 md:py-28 lg:py-32", className)}>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  id,
  align = "start",
  className,
  action,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  id?: string;
  align?: "start" | "center";
  className?: string;
  action?: ReactNode;
}) {
  return (
    <Reveal className={cn("flex flex-col gap-5", align === "center" ? "items-center text-center" : "md:flex-row md:items-end md:justify-between", className)}>
      <div className={cn("flex max-w-3xl flex-col gap-4", align === "center" && "items-center")}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 id={id} className="font-display text-title font-light tracking-[-0.02em] text-balance">
          {title}
        </h2>
        {intro && <p className="max-w-2xl text-base leading-relaxed text-sand md:text-lg">{intro}</p>}
      </div>
      {action}
    </Reveal>
  );
}
