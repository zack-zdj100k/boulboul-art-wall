"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Accessible modal built on the native <dialog>: focus trapping, Escape and inert
 * background come from the browser.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  closeLabel = "Fermer",
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  size?: "md" | "lg" | "full";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      document.documentElement.style.overflow = "hidden";
    }
    if (!open && el.open) el.close();
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        "m-auto max-h-[92dvh] w-[calc(100%-24px)] overflow-hidden rounded-panel border border-line bg-umber-900 p-0 text-ivory shadow-lifted open:animate-[dialogIn_.32s_var(--ease-editorial)]",
        size === "md" && "max-w-xl",
        size === "lg" && "max-w-3xl",
        size === "full" && "max-w-6xl",
        className,
      )}
    >
      <style>{`@keyframes dialogIn{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}`}</style>
      <div className="flex max-h-[92dvh] flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <h2 id="dialog-title" className="font-display text-xl">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full text-sand transition hover:bg-ivory/8 hover:text-ivory" aria-label={closeLabel}>
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </dialog>
  );
}
