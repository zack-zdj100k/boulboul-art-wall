"use client";

import { Star } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export function Stars({ value, size = "sm", label }: { value: number; size?: "sm" | "md"; label?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? `${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className={cn(size === "sm" ? "size-3.5" : "size-5", n <= Math.round(value) ? "fill-gold text-gold" : "text-stone/50")} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange, label, name = "rating" }: { value: number; onChange: (v: number) => void; label: string; name?: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[13px] font-semibold text-sand">{label}</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" />
            <Star aria-hidden className={cn("size-8 transition peer-focus-visible:outline-2 peer-focus-visible:outline-gold", n <= value ? "fill-gold text-gold" : "text-stone hover:text-gold")} />
            <span className="sr-only">{n} / 5</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
