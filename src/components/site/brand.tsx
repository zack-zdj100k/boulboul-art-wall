import Link from "next/link";
import { cn } from "@/lib/utils";

/** Arch mark — echoes the brand's arched LED mirrors. */
export function BrandMark({ className, ...rest }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 40" className={cn("h-7 w-auto", className)} aria-hidden {...rest}>
      <path d="M4 38V16a12 12 0 0 1 24 0v22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="25" r="2.6" fill="var(--color-gold-soft)" />
    </svg>
  );
}

export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-3", className)} aria-label="Boulboul Art Wall">
      <BrandMark className="text-gold transition-transform duration-500 ease-editorial group-hover:-translate-y-0.5" />
      <span className="flex flex-col leading-none" dir="ltr">
        <span className="font-display text-[19px] tracking-[0.16em] text-ivory [font-family:var(--font-fraunces)]">BOULBOUL</span>
        <span className="mt-1 text-[9px] font-bold tracking-[0.5em] text-gold">ART WALL</span>
      </span>
    </Link>
  );
}
