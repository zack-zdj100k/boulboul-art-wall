"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/frontend/components/ui/button";
import { fieldClasses } from "@/frontend/components/ui/field";
import { useToast } from "@/frontend/components/ui/toast";
import { formatPrice } from "@/shared/i18n/config";
import { api } from "@/frontend/lib/api-client";
import { computeCustomQuote } from "@/shared/lib/quote";
import { cn } from "@/shared/lib/utils";
import { CUSTOM_STATUS_FR } from "./ui";

type Initial = {
  status: string;
  adminNotes: string;
  price: number | null;
  discountType: "PERCENT" | "FIXED" | null;
  discountValue: number | null;
  deliveryFee: number | null;
};

const num = (v: string) => (v === "" ? null : Math.max(0, Math.round(Number(v))));

/** Status, internal notes and the quote (price, discount, delivery) of a custom request. */
export function CustomOrderEditor({ id, initial, estimate }: { id: string; initial: Initial; estimate: number | null }) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState(initial.status);
  const [adminNotes, setAdminNotes] = useState(initial.adminNotes);
  const [price, setPrice] = useState(initial.price?.toString() ?? "");
  const [discountType, setDiscountType] = useState<"" | "PERCENT" | "FIXED">(initial.discountType ?? "");
  const [discountValue, setDiscountValue] = useState(initial.discountValue?.toString() ?? "");
  const [deliveryFee, setDeliveryFee] = useState(initial.deliveryFee?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const quote = { price: num(price), discountType: discountType || null, discountValue: num(discountValue), deliveryFee: num(deliveryFee) };
  const preview = computeCustomQuote(quote);
  const percentTooHigh = discountType === "PERCENT" && (quote.discountValue ?? 0) > 100;
  const sliderMax = discountType === "PERCENT" ? 100 : Math.max(quote.price ?? 0, 0);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (percentTooHigh) return;
        setSaving(true);
        try {
          await api(`/api/admin/custom-orders/${id}`, { method: "PATCH", json: { status, adminNotes, ...quote } });
          toast.show("Demande mise à jour.", "success");
          router.refresh();
        } catch {
          toast.show("Erreur lors de l'enregistrement.", "error");
        } finally {
          setSaving(false);
        }
      }}
    >
      <fieldset className="flex flex-col gap-4 rounded-field border border-line p-4">
        <legend className="px-1 text-xs font-bold tracking-[0.12em] text-sand uppercase">Devis</legend>
        {estimate != null && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-field bg-gold/10 px-3 py-2 text-sm">
            <span>
              Estimation vue par le client (prix stable ± 10 cm + options) : <strong className="tabular-nums">{formatPrice(estimate, "fr")}</strong>
            </span>
            <button type="button" onClick={() => setPrice(String(estimate))} className="text-xs font-bold text-gold hover:underline">
              Utiliser comme prix
            </button>
          </div>
        )}
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-sand">
          Prix de la création (DA)
          <input type="number" min={0} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="ex. 15000" className={cn(fieldClasses, "h-11 tabular-nums")} />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-sand">Remise</span>
          <div className="flex gap-2">
            <select
              aria-label="Type de remise"
              value={discountType}
              onChange={(e) => {
                setDiscountType(e.target.value as "" | "PERCENT" | "FIXED");
                setDiscountValue("");
              }}
              className={cn(fieldClasses, "h-11 w-40")}
            >
              <option value="">Aucune</option>
              <option value="PERCENT">Pourcentage (%)</option>
              <option value="FIXED">Montant (DA)</option>
            </select>
            {discountType && (
              <input
                type="number"
                min={0}
                max={discountType === "PERCENT" ? 100 : undefined}
                aria-label="Valeur de la remise"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                aria-invalid={percentTooHigh}
                className={cn(fieldClasses, "h-11 flex-1 tabular-nums")}
              />
            )}
          </div>
          {discountType && sliderMax > 0 && (
            <input
              type="range"
              min={0}
              max={sliderMax}
              step={discountType === "PERCENT" ? 1 : 100}
              value={Math.min(quote.discountValue ?? 0, sliderMax)}
              onChange={(e) => setDiscountValue(e.target.value)}
              aria-label="Ajuster la remise"
              className="w-full accent-[var(--color-gold)]"
            />
          )}
          {percentTooHigh && <p className="text-xs text-ember">Le pourcentage ne peut pas dépasser 100.</p>}
        </div>

        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-sand">
          Frais de livraison (DA)
          <input type="number" min={0} inputMode="numeric" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} placeholder="facultatif" className={cn(fieldClasses, "h-11 tabular-nums")} />
        </label>

        <dl className="flex flex-col gap-1.5 rounded-field bg-umber-900 p-4 text-sm">
          <div className="flex justify-between"><dt className="text-sand">Prix</dt><dd className="tabular-nums">{quote.price == null ? "—" : formatPrice(quote.price, "fr")}</dd></div>
          {preview.discount > 0 && <div className="flex justify-between text-gold"><dt>Remise</dt><dd className="tabular-nums">− {formatPrice(preview.discount, "fr")}</dd></div>}
          {quote.deliveryFee != null && <div className="flex justify-between"><dt className="text-sand">Livraison</dt><dd className="tabular-nums">{formatPrice(quote.deliveryFee, "fr")}</dd></div>}
          <div className="mt-1 flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{preview.total == null ? "Non chiffré" : formatPrice(preview.total, "fr")}</dd></div>
        </dl>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-sand">
        Statut
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(fieldClasses, "h-11")}>
          {Object.entries(CUSTOM_STATUS_FR).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-sand">
        Notes internes (faisabilité, échanges…)
        <textarea rows={5} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} className={cn(fieldClasses, "py-3")} maxLength={5000} />
      </label>
      <div>
        <Button type="submit" loading={saving} disabled={percentTooHigh}>Enregistrer</Button>
      </div>
    </form>
  );
}
