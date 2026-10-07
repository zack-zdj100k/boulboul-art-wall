"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const fieldClasses =
  "w-full rounded-field border border-line-strong bg-umber-900/70 px-4 text-[15px] text-ivory placeholder:text-stone/80 transition-[border-color,box-shadow,background-color] duration-200 hover:border-ivory/35 focus:border-gold focus:bg-umber-900 focus:outline-none focus:ring-4 focus:ring-gold/15 aria-[invalid=true]:border-ember aria-[invalid=true]:ring-ember/15 disabled:opacity-50";

type FieldProps = {
  label: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  optional?: string;
  className?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
};

/** Label + control + hint + error, wired for screen readers. Errors never rely on colour alone. */
export function Field({ label, error, hint, optional, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 text-[13px] font-semibold text-sand">
        <span>{label}</span>
        {optional && <span className="text-[11px] font-medium text-stone">{optional}</span>}
      </label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-stone">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-xs font-medium text-ember">
          <span aria-hidden>⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClasses, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClasses, "min-h-32 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(fieldClasses, "h-12 appearance-none pe-10", className)} {...props}>
        {children}
      </select>
      <span aria-hidden className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-stone">
        ▾
      </span>
    </div>
  );
}
