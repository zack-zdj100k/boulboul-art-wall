import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "gold" | "ember" | "sage" | "outline" | "demo";

const tones: Record<Tone, string> = {
  neutral: "bg-ivory/8 text-sand",
  gold: "bg-gold text-paper",
  ember: "bg-ember text-paper",
  sage: "bg-sage/15 text-sage",
  outline: "border border-line-strong text-sand",
  demo: "border border-dashed border-gold/70 bg-ink/85 text-gold",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]", tones[tone], className)}>
      {children}
    </span>
  );
}
