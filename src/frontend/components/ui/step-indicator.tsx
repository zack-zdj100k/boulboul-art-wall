"use client";

import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/** Numbered progress for multi-step forms (v-form-8 language, Boulboul styling). */
export function StepIndicator({ steps, current, label }: { steps: string[]; current: number; label?: string }) {
  return (
    <nav aria-label={label}>
      <ol className="flex items-start gap-1.5 sm:gap-3">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s} className="flex min-w-0 flex-1 flex-col gap-2" aria-current={active ? "step" : undefined}>
              <div className="relative h-[2px] overflow-hidden rounded-full bg-line">
                <span className={cn("absolute inset-y-0 start-0 bg-gold transition-[width] duration-500 ease-editorial", done ? "w-full" : active ? "w-1/2" : "w-0")} />
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors",
                    done && "bg-gold text-ink",
                    active && "border border-gold text-gold",
                    !done && !active && "border border-line-strong text-stone",
                  )}
                >
                  {done ? <Check className="size-3.5" aria-hidden /> : String(i + 1).padStart(2, "0")}
                </span>
                {/* Only the current step is labelled inline; the others stay readable via the counter below / sr-only. */}
                <span className={cn("truncate text-xs font-semibold", active ? "hidden text-ivory md:block" : "sr-only")}>{s}</span>
                <span className="sr-only">{done ? " (✓)" : ""}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs font-semibold text-sand md:hidden" aria-hidden>
        {String(current + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")} — {steps[current]}
      </p>
    </nav>
  );
}
