import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/frontend/components/ui/badge";
import { cn } from "@/shared/lib/utils";

export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-2">
        {back && (
          <Link href={back.href} className="text-xs font-semibold text-stone hover:text-ivory">
            ← {back.label}
          </Link>
        )}
        <h1 className="font-display text-3xl font-light md:text-4xl">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-sand">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, children, className, actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn("min-w-0 rounded-panel border border-line bg-ink/60", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-sand">{title}</h2>
          {actions}
        </div>
      )}
      <div className="min-w-0 p-5">{children}</div>
    </section>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-panel border border-line">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-3 [&_th]:bg-umber-900 [&_th]:px-4 [&_th]:py-3 [&_th]:text-[11px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[0.12em] [&_th]:text-stone [&_tr:hover_td]:bg-ivory/[0.02]">
        {children}
      </table>
    </div>
  );
}

export const ORDER_STATUS_FR: Record<string, string> = { PENDING: "En attente", CONTACTING: "Client en contact", CONFIRMED: "Confirmée", DELIVERED: "Livrée", CANCELLED: "Annulée" };
export const RETURN_STATUS_FR: Record<string, string> = {
  REQUESTED: "Demandée",
  UNDER_REVIEW: "En étude",
  APPROVED: "Acceptée",
  REJECTED: "Refusée",
  RETURN_RECEIVED: "Article reçu",
  EXCHANGE_PROCESSING: "Échange en cours",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
};
export const RETURN_TYPE_FR: Record<string, string> = { RETURN: "Retour", EXCHANGE: "Échange" };
export const CUSTOM_STATUS_FR: Record<string, string> = { PENDING: "Reçue", REVIEWING: "En étude", CONTACTED: "Client contacté", APPROVED: "Acceptée", REJECTED: "Refusée", DELIVERED: "Livrée", COMPLETED: "Terminée" };
export const REVIEW_STATUS_FR: Record<string, string> = { PENDING: "À modérer", APPROVED: "Approuvé", REJECTED: "Rejeté", HIDDEN: "Masqué" };

const TONE: Record<string, "neutral" | "gold" | "sage" | "ember" | "outline"> = {
  PENDING: "outline", CONTACTING: "neutral", CONFIRMED: "gold", DELIVERED: "sage", CANCELLED: "ember",
  REQUESTED: "outline", UNDER_REVIEW: "neutral", RETURN_RECEIVED: "neutral", EXCHANGE_PROCESSING: "neutral",
  REVIEWING: "neutral", CONTACTED: "neutral", APPROVED: "sage", REJECTED: "ember", COMPLETED: "sage", HIDDEN: "neutral",
};

export function StatusBadge({ status, labels = ORDER_STATUS_FR }: { status: string; labels?: Record<string, string> }) {
  return <Badge tone={TONE[status] ?? "neutral"}>{labels[status] ?? status}</Badge>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-panel border border-dashed border-line-strong p-10 text-center text-sm text-sand">{children}</div>;
}
