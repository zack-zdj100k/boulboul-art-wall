import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({ page, pages, href, label }: { page: number; pages: number; href: (p: number) => string; label: string }) {
  if (pages <= 1) return null;
  const items = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1);
  return (
    <nav aria-label={label} className="flex items-center justify-center gap-1.5">
      <Link aria-label="‹" href={href(Math.max(1, page - 1))} aria-disabled={page === 1} className={cn("grid size-10 place-items-center rounded-full border border-line text-sand hover:border-ivory/50 rtl:rotate-180", page === 1 && "pointer-events-none opacity-40")}>
        <ChevronLeft className="size-4" />
      </Link>
      {items.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && items[i - 1] !== p - 1 && <span className="px-1 text-stone">…</span>}
          <Link href={href(p)} aria-current={p === page ? "page" : undefined} className={cn("grid size-10 place-items-center rounded-full text-sm font-semibold tabular-nums", p === page ? "bg-ivory text-ink" : "text-sand hover:bg-ivory/8")}>
            {p}
          </Link>
        </span>
      ))}
      <Link aria-label="›" href={href(Math.min(pages, page + 1))} aria-disabled={page === pages} className={cn("grid size-10 place-items-center rounded-full border border-line text-sand hover:border-ivory/50 rtl:rotate-180", page === pages && "pointer-events-none opacity-40")}>
        <ChevronRight className="size-4" />
      </Link>
    </nav>
  );
}
