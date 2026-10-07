import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

type Variant = "primary" | "gold" | "outline" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold tracking-[0.01em] transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-gallery disabled:pointer-events-none disabled:opacity-45 active:translate-y-px";

const variants: Record<Variant, string> = {
  primary: "rounded-full bg-ivory text-paper hover:bg-night hover:shadow-[0_12px_30px_-14px_rgb(37_37_34/0.55)]",
  gold: "rounded-full bg-gold text-paper hover:bg-gold-deep hover:shadow-glow",
  outline: "rounded-full border border-ivory/35 text-ivory hover:border-ivory hover:bg-ivory/5",
  ghost: "rounded-full text-sand hover:bg-ivory/7 hover:text-ivory",
  danger: "rounded-full border border-ember/60 text-ember hover:bg-ember/10",
  link: "text-gold underline-offset-4 hover:underline",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-6 text-sm",
  lg: "h-14 px-8 text-[15px]",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], variant !== "link" && sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode };

export function Button({ variant, size, loading, icon, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode };

export function ButtonLink({ variant, size, icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)} />;
}
