"use client";

import { Check, Copy, Mail, MessageCircle, Phone, RotateCcw, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { fieldClasses } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { formatPrice } from "@/i18n/config";
import { api, ApiError } from "@/lib/api-client";
import { calculateNegotiatedPrice, calculateOrderTotal, PricingError } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_FR, RETURN_STATUS_FR, RETURN_TYPE_FR } from "./ui";

// Manager Orders — client panels of the order page (structure adapted from KING 253's manager
// orders, without any stock logic). Every amount shown as a preview uses the shared pricing
// engine; the server recomputes and records everything.

const ERRORS: Record<string, string> = {
  "order.invalidTransition": "Ce changement de statut n'est pas autorisé.",
  "order.concurrentUpdate": "La commande a été modifiée entre-temps. Rechargez la page.",
  "order.sameStatus": "La commande a déjà ce statut.",
  "order.closed": "Commande livrée ou annulée : son prix ne peut plus être modifié.",
  "order.noPreviousStatus": "Aucun statut précédent.",
  "order.notGrouped": "Cette commande n'est pas dans une livraison groupée.",
  "order.productMissing": "Le produit a été supprimé : impossible de rechercher un nouveau prix.",
  "order.dimensionsUnchanged": "Ce sont déjà les dimensions de la commande.",
  "order.negotiationUnchanged": "Cette remise est déjà appliquée.",
  "order.deliveryUnchanged": "Ces frais de livraison sont déjà appliqués.",
  "pricing.needsSurMesure": "Aucun prix pour ces dimensions : ce n'est pas une mesure proposée et le Sur Mesure de ce produit est inactif ou hors limites. Réglez-le dans Produits → Tarification.",
  "pricing.invalidDiscount": "Remise invalide (négative, > 100 % ou supérieure au prix).",
  "pricing.invalidDeliveryFee": "Frais de livraison invalides.",
  "errors.invalidSize": "Dimensions invalides.",
  "returns.notDelivered": "Retour / échange possible uniquement sur une commande livrée.",
  "returns.alreadyOpen": "Une demande est déjà en cours pour cette commande.",
  "returns.invalidTransition": "Ce changement de statut n'est pas autorisé.",
  "returns.invalidQuantity": "Quantité invalide.",
  "returns.sameMeasure": "C'est déjà la mesure de la commande.",
  "returns.replacementRequired": "Choisissez la mesure que le client prend à la place.",
};
const errText = (e: unknown) => ERRORS[(e as ApiError).code] ?? "Action impossible.";
// Field look without the base `w-full`, so each input sets its own width (cn does not merge classes).
const inp = cn(fieldClasses.replace("w-full ", ""), "h-10 px-3 font-normal");

function useAction() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.show(success, "success");
      router.refresh();
      return true;
    } catch (e) {
      toast.show(errText(e), "error");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

// ───────────────────────── Status

const FLOW = ["PENDING", "CONTACTING", "CONFIRMED", "DELIVERED"] as const;
const NEXT_LABEL: Record<string, string> = {
  CONTACTING: "Client en contact",
  CONFIRMED: "Confirmer la commande",
  DELIVERED: "Marquer comme livrée",
  CANCELLED: "Annuler la commande",
};

function RevertStatus({ orderId, previous }: { orderId: string; previous: string }) {
  const { busy, run } = useAction();
  const confirm = useConfirm();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        const ok = await confirm({
          title: `Revenir à « ${ORDER_STATUS_FR[previous]} » ?`,
          message: "Annule la dernière étape (erreur de manipulation). C'est noté dans la chronologie. Aucun e-mail n'est envoyé, et l'e-mail de confirmation ne sera pas renvoyé si la commande est reconfirmée.",
          confirmLabel: "Revenir en arrière",
        });
        if (ok) await run(() => api(`/api/admin/orders/${orderId}/revert`, { method: "POST", json: {} }), `Statut : ${ORDER_STATUS_FR[previous]}`);
      }}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-sand hover:text-ivory disabled:opacity-50"
    >
      <Undo2 className="size-3.5" /> Revenir au statut précédent ({ORDER_STATUS_FR[previous]})
    </button>
  );
}

export function OrderStatusPanel({ orderId, status, allowed, customerEmail, previous }: { orderId: string; status: string; allowed: string[]; customerEmail: string; previous: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const next = FLOW[FLOW.indexOf(status as (typeof FLOW)[number]) + 1];
  const [target, setTarget] = useState<string | null>(null);
  const [note, setNote] = useState("");

  if (!allowed.length) {
    return (
      <div className="flex flex-col items-start gap-3 text-sm text-sand">
        <p>Commande {ORDER_STATUS_FR[status]?.toLowerCase()} — statut final.</p>
        {status === "DELIVERED" && (
          <a href="#retours" className="inline-flex items-center gap-2 font-semibold text-gold hover:underline">
            <RotateCcw className="size-3.5" /> Retour ou échange ↓
          </a>
        )}
        {previous && <RevertStatus orderId={orderId} previous={previous} />}
      </div>
    );
  }

  const apply = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const res = await api<{ status: string; email: { ok: boolean } | null }>(`/api/admin/orders/${orderId}`, { method: "PATCH", json: { status: target, note: note || undefined } });
      if (res.email && !res.email.ok) toast.show("Statut mis à jour, mais l'e-mail client n'a pas pu être envoyé (voir E-mails).", "error");
      else if (res.email?.ok) toast.show("Commande confirmée — e-mail envoyé au client.", "success");
      else toast.show(`Statut : ${ORDER_STATUS_FR[res.status]}`, "success");
      setTarget(null);
      setNote("");
      router.refresh();
    } catch (e) {
      toast.show(errText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ol className="mb-5 flex flex-wrap items-center gap-1 text-[11px] font-bold uppercase tracking-[0.1em]" aria-label="Progression">
        {FLOW.map((s, i) => {
          const done = FLOW.indexOf(status as (typeof FLOW)[number]) >= i;
          return (
            <li key={s} className="flex items-center gap-1">
              {i > 0 && <span className={cn("h-px w-4 sm:w-8", done ? "bg-gold" : "bg-line-strong")} aria-hidden />}
              <span className={cn("rounded-full px-2.5 py-1", s === status ? "bg-gold text-paper" : done ? "text-gold" : "text-stone")}>{ORDER_STATUS_FR[s]}</span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        {next && allowed.includes(next) && (
          <Button variant="gold" onClick={() => setTarget(next)}>
            → {NEXT_LABEL[next]}
          </Button>
        )}
        {allowed
          .filter((s) => s !== next && s !== "CANCELLED")
          .map((s) => (
            <Button key={s} variant="outline" size="sm" onClick={() => setTarget(s)}>
              {NEXT_LABEL[s]}
            </Button>
          ))}
        {allowed.includes("CANCELLED") && (
          <Button variant="danger" size="sm" onClick={() => setTarget("CANCELLED")}>
            Annuler la commande
          </Button>
        )}
      </div>
      {previous && (
        <div className="mt-3">
          <RevertStatus orderId={orderId} previous={previous} />
        </div>
      )}
      <Dialog open={!!target} onClose={() => !busy && setTarget(null)} title={target ? NEXT_LABEL[target] : ""}>
        <div className="flex flex-col gap-5 p-6">
          {target === "CONFIRMED" ? (
            <p className="flex items-start gap-3 rounded-field border border-gold/40 bg-gold/10 p-4 text-sm">
              <Mail className="mt-0.5 size-4 shrink-0 text-gold" />
              <span>
                Un e-mail de confirmation (avec le prix final négocié, la livraison et le total) sera envoyé à <strong dir="ltr">{customerEmail}</strong>.
              </span>
            </p>
          ) : (
            <p className="text-sm text-sand">Aucun e-mail ne sera envoyé pour ce changement de statut.</p>
          )}
          <label className="flex flex-col gap-2 text-xs font-semibold text-sand">
            Note pour l&apos;historique (facultatif)
            <textarea rows={3} className={cn(fieldClasses, "min-h-20 py-2 font-normal")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={busy}>Retour</Button>
            <Button variant={target === "CANCELLED" ? "danger" : "gold"} onClick={apply} loading={busy}>Valider</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

// ───────────────────────── Customer quick actions

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked — the value stays visible to copy by hand */
        }
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3 text-xs font-semibold text-sand transition hover:border-ivory/50 hover:text-ivory"
    >
      {done ? <Check className="size-3.5 text-sage" /> : <Copy className="size-3.5" />} {done ? "Copié" : label}
    </button>
  );
}

/** "0550 12 34 56" → "213550123456" for wa.me links. */
function whatsappNumber(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("00213")) return d.slice(2);
  if (d.startsWith("213")) return d;
  if (d.startsWith("0")) return `213${d.slice(1)}`;
  return d;
}

export function CustomerQuickActions({ name, phone, email, address, orderNumber, total, status }: { name: string; phone: string; email: string; address: string; orderNumber: string; total: number; status: string }) {
  const first = name.split(" ")[0];
  const wa = `Bonjour ${first}, ici Boulboul Art Wall au sujet de votre commande ${orderNumber} (${ORDER_STATUS_FR[status]?.toLowerCase()}) — total ${formatPrice(total, "fr")}.`;
  const action = "inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <a href={`tel:${phone.replace(/\s/g, "")}`} className={cn(action, "bg-gold text-paper hover:bg-gold-deep")}>
          <Phone className="size-3.5" /> Appeler
        </a>
        <a href={`https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(wa)}`} target="_blank" rel="noreferrer" className={cn(action, "border border-ivory/35 hover:border-ivory")}>
          <MessageCircle className="size-3.5" /> WhatsApp
        </a>
        <a href={`mailto:${email}?subject=${encodeURIComponent(`Boulboul Art Wall — ${orderNumber}`)}`} className={cn(action, "border border-ivory/35 hover:border-ivory")}>
          <Mail className="size-3.5" /> E-mail
        </a>
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyButton value={phone} label="Copier le téléphone" />
        <CopyButton value={email} label="Copier l'e-mail" />
        <CopyButton value={address} label="Copier l'adresse" />
      </div>
      <p className="text-xs text-stone">WhatsApp s&apos;ouvre avec un message préparé — rien n&apos;est envoyé tant que vous n&apos;appuyez pas sur « envoyer ».</p>
    </div>
  );
}

// ───────────────────────── Negotiation

function Row({ label, value, strong, tone }: { label: ReactNode; value: ReactNode; strong?: boolean; tone?: "gold" | "stone" }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "border-t border-line pt-2 text-base font-semibold", tone === "gold" && "text-gold", tone === "stone" && "text-stone")}>
      <dt className={cn(!strong && !tone && "text-sand")}>{label}</dt>
      <dd className="text-end tabular-nums">{value}</dd>
    </div>
  );
}

export function NegotiationPanel({ orderId, subtotal, negotiatedDiscount, deliveryFee, editable }: { orderId: string; subtotal: number; negotiatedDiscount: number; deliveryFee: number | null; editable: boolean }) {
  const { busy, run } = useAction();
  const [type, setType] = useState<"AMOUNT" | "PERCENT">("AMOUNT");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  let preview: { discount: number; percent: number | null; finalPrice: number; total: number } | null = null;
  let invalid = false;
  if (value.trim() !== "") {
    try {
      const n = calculateNegotiatedPrice(subtotal, { type, value: Number(value) });
      preview = { ...n, total: calculateOrderTotal({ subtotal, negotiatedDiscount: n.discount, deliveryFee }).total };
    } catch (e) {
      invalid = e instanceof PricingError;
    }
  }

  if (!editable) return <p className="text-sm text-stone">Commande livrée ou annulée : la négociation est close.</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-stone">
        La remise s&apos;applique au prix des produits après promotion ({formatPrice(subtotal, "fr")}). Elle ne concerne que cette commande : les prix officiels du produit ne changent pas.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div role="radiogroup" aria-label="Type de remise" className="flex rounded-full border border-line-strong p-0.5">
          {(["AMOUNT", "PERCENT"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={type === k} onClick={() => setType(k)} className={cn("h-9 rounded-full px-4 text-xs font-semibold", type === k ? "bg-ivory text-paper" : "text-sand")}>
              {k === "AMOUNT" ? "Montant (DA)" : "Pourcentage (%)"}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={0}
          max={type === "PERCENT" ? 100 : subtotal}
          step={type === "PERCENT" ? "0.5" : "1"}
          aria-label="Valeur de la remise"
          aria-invalid={invalid}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={type === "PERCENT" ? "ex. 5" : "ex. 300"}
          className={cn(inp, "w-32 tabular-nums")}
        />
      </div>
      {type === "AMOUNT" && subtotal > 0 && (
        <input type="range" min={0} max={subtotal} step={50} value={Math.min(Number(value) || 0, subtotal)} onChange={(e) => setValue(e.target.value)} aria-label="Ajuster la remise" className="w-full accent-[var(--color-gold)]" />
      )}
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note (ex. accord par téléphone)" aria-label="Note de négociation" className={cn(inp, "w-full")} />
      {invalid && <p className="text-xs text-ember">{ERRORS["pricing.invalidDiscount"]}</p>}
      {preview && (
        <dl className="flex flex-col gap-1.5 rounded-field bg-umber-900 p-3 text-sm">
          <Row label="Remise négociée" value={`− ${formatPrice(preview.discount, "fr")}${preview.percent != null ? ` (${preview.percent} %)` : ""}`} tone="gold" />
          <Row label="Prix final des produits" value={formatPrice(preview.finalPrice, "fr")} />
          <Row label="Nouveau total" value={formatPrice(preview.total, "fr")} strong />
        </dl>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="gold"
          disabled={!preview || invalid}
          loading={busy}
          onClick={async () => {
            if (await run(() => api(`/api/admin/orders/${orderId}/negotiation`, { method: "POST", json: { type, value: Number(value), note: note || undefined } }), "Négociation enregistrée.")) {
              setValue("");
              setNote("");
            }
          }}
        >
          Appliquer la remise
        </Button>
        {negotiatedDiscount > 0 && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => api(`/api/admin/orders/${orderId}/negotiation`, { method: "POST", json: { type: "AMOUNT", value: 0, note: note || "Négociation annulée" } }), "Négociation retirée.")}>
            Retirer la négociation
          </Button>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Dimension change

type Preview = {
  quote: { widthCm: number; heightCm: number; pricingType: string; pricingLabel: string | null; surMesure: { refWidthCm: number; refHeightCm: number; refPrice: number; widthAdjustment: number; heightAdjustment: number } | null; officialPrice: number; promotionDiscount: number; priceAfterPromotion: number; unitPrice: number; total: number };
  totals: { finalProductPrice: number; total: number };
};

export function DimensionChangePanel({ orderId, item, negotiatedDiscount }: { orderId: string; item: { id: string; widthCm: number; heightCm: number; productMissing: boolean }; negotiatedDiscount: number }) {
  const { busy, run } = useAction();
  const [w, setW] = useState(String(item.widthCm));
  const [h, setH] = useState(String(item.heightCm));
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (item.productMissing) return <p className="text-sm text-stone">Produit supprimé du catalogue : les dimensions ne peuvent plus être re-tarifées.</p>;

  const check = async () => {
    setChecking(true);
    setError(null);
    setPreview(null);
    try {
      setPreview(await api<Preview>(`/api/admin/orders/${orderId}/dimensions?itemId=${item.id}&widthCm=${Number(w)}&heightCm=${Number(h)}`));
    } catch (e) {
      setError(errText(e));
    } finally {
      setChecking(false);
    }
  };
  const same = Number(w) === item.widthCm && Number(h) === item.heightCm;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-sand">Longueur (cm)<input type="number" min={1} value={w} onChange={(e) => { setW(e.target.value); setPreview(null); }} className={cn(inp, "w-28 tabular-nums")} /></label>
        <span className="pb-2 text-stone">×</span>
        <label className="flex flex-col gap-1 text-xs font-semibold text-sand">Hauteur (cm)<input type="number" min={1} value={h} onChange={(e) => { setH(e.target.value); setPreview(null); }} className={cn(inp, "w-28 tabular-nums")} /></label>
        <Button size="sm" variant="outline" onClick={check} loading={checking} disabled={same || !(Number(w) > 0 && Number(h) > 0)}>Rechercher le prix</Button>
      </div>
      <p className="text-xs text-stone">Recherche : mesure proposée exacte d&apos;abord, sinon calcul Sur Mesure (prix de référence ± par 10 cm).</p>
      {error && <p className="text-xs text-ember">{error}</p>}
      {preview && (
        <div className="flex flex-col gap-3 rounded-field border border-gold/40 bg-gold/5 p-3">
          <dl className="flex flex-col gap-1.5 text-sm">
            <Row label="Tarif" value={preview.quote.pricingType === "SUR_MESURE" ? "Sur Mesure (prix de référence ± 10 cm)" : `Mesure proposée${preview.quote.pricingLabel ? ` · ${preview.quote.pricingLabel}` : ""}`} />
            {preview.quote.surMesure && (
              <Row
                label={`Calcul depuis ${preview.quote.surMesure.refWidthCm} × ${preview.quote.surMesure.refHeightCm} (${formatPrice(preview.quote.surMesure.refPrice, "fr")})`}
                value={`${preview.quote.surMesure.widthAdjustment >= 0 ? "+" : "−"} ${formatPrice(Math.abs(preview.quote.surMesure.widthAdjustment), "fr")} / ${preview.quote.surMesure.heightAdjustment >= 0 ? "+" : "−"} ${formatPrice(Math.abs(preview.quote.surMesure.heightAdjustment), "fr")}`}
                tone="stone"
              />
            )}
            <Row label="Prix officiel" value={formatPrice(preview.quote.officialPrice, "fr")} />
            {preview.quote.promotionDiscount > 0 && <Row label="Promotion" value={`− ${formatPrice(preview.quote.promotionDiscount, "fr")}`} tone="gold" />}
            <Row label="Nouveau prix de la ligne" value={formatPrice(preview.quote.total, "fr")} />
            <Row label="Nouveau total" value={formatPrice(preview.totals.total, "fr")} strong />
          </dl>
          {negotiatedDiscount > 0 && <p className="text-xs text-gold">La négociation actuelle (− {formatPrice(negotiatedDiscount, "fr")}) sera retirée : renégociez si besoin.</p>}
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note (ex. demande du client)" aria-label="Note du changement" className={cn(inp, "w-full")} />
          <div>
            <Button
              size="sm"
              variant="gold"
              loading={busy}
              onClick={async () => {
                if (await run(() => api(`/api/admin/orders/${orderId}/dimensions`, { method: "POST", json: { itemId: item.id, widthCm: Number(w), heightCm: Number(h), note: note || undefined } }), "Dimensions et prix mis à jour.")) {
                  setPreview(null);
                  setNote("");
                }
              }}
            >
              Appliquer {preview.quote.widthCm} × {preview.quote.heightCm} cm
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Delivery fee

export function DeliveryFeePanel({ orderId, deliveryFee, editable }: { orderId: string; deliveryFee: number | null; editable: boolean }) {
  const { busy, run } = useAction();
  const [fee, setFee] = useState(deliveryFee?.toString() ?? "");
  const [note, setNote] = useState("");
  if (!editable) return null;
  const parsed = fee.trim() === "" ? null : Number(fee);
  const invalid = parsed != null && !(Number.isInteger(parsed) && parsed >= 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-sand">
          Frais de livraison (DA)
          <input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="vide = à confirmer" aria-invalid={invalid} className={cn(inp, "w-40 tabular-nums")} />
        </label>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note (facultatif)" aria-label="Note livraison" className={cn(inp, "min-w-40 flex-1")} />
        <Button size="sm" variant="outline" disabled={invalid || parsed === deliveryFee} loading={busy} onClick={() => run(() => api(`/api/admin/orders/${orderId}/delivery`, { method: "POST", json: { deliveryFee: parsed, note: note || undefined } }), "Livraison mise à jour.")}>
          Enregistrer
        </Button>
      </div>
      {invalid && <p className="text-xs text-ember">Montant entier ≥ 0.</p>}
    </div>
  );
}

// ───────────────────────── Private notes

export function ManagerNotesPanel({ orderId, notes }: { orderId: string; notes: string }) {
  const { busy, run } = useAction();
  const [value, setValue] = useState(notes);
  return (
    <div className="flex flex-col gap-3">
      <textarea rows={5} value={value} onChange={(e) => setValue(e.target.value)} maxLength={5000} placeholder="Échanges avec le client, accord sur le prix, détails de fabrication…" aria-label="Notes privées" className={cn(fieldClasses, "py-3 text-sm font-normal")} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-stone">Visible uniquement par les gestionnaires.</span>
        <Button size="sm" variant="outline" disabled={value === notes} loading={busy} onClick={() => run(() => api(`/api/admin/orders/${orderId}/notes`, { method: "PUT", json: { managerNotes: value } }), "Notes enregistrées.")}>
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────── Returns & exchanges (KING 253 flow, no stock)

export type ReturnItem = {
  id: string;
  type: "RETURN" | "EXCHANGE";
  status: string;
  quantity: number;
  reason: string;
  details: string | null;
  managerNote: string | null;
  source: string;
  createdAt: string;
  item: { name: string; widthCm: number; heightCm: number; unitPrice: number } | null;
  replacement: { productName: string | null; widthCm: number; heightCm: number; frameName: string | null; extras: string[]; pricingType: string | null; price: number | null } | null;
  next: string[];
};

export type ReturnableItem = {
  id: string;
  productId: string | null;
  name: string;
  widthCm: number;
  heightCm: number;
  unitPrice: number; // per unit with options, as ordered
  returnable: number;
};

/** Products the customer can take instead (exchange for anything). */
export type ExchangeProduct = {
  id: string;
  name: string;
  measures: { widthCm: number; heightCm: number; label: string | null }[];
  surMesure: boolean;
  frames: { id: string; name: string; price: number }[];
  extras: { id: string; name: string; price: number }[];
};

const REASONS: [string, string][] = [
  ["WRONG_SIZE", "Mauvaise dimension"],
  ["DAMAGED", "Abîmé à la livraison"],
  ["DEFECT", "Défaut de fabrication"],
  ["NOT_AS_ORDERED", "Différent de la commande"],
  ["CHANGED_MIND", "Changement d'avis"],
  ["OTHER", "Autre"],
];

const pill = (on: boolean) =>
  cn("inline-flex h-10 items-center rounded-full border px-4 text-[13px] font-semibold transition", on ? "border-gold bg-gold/15 text-ivory shadow-[inset_0_0_0_1px_var(--color-gold)]" : "border-line-strong text-sand hover:border-ivory/50");

function priceDiff(diff: number) {
  return diff === 0 ? "même prix" : `différence ${diff > 0 ? "+" : "−"} ${formatPrice(Math.abs(diff), "fr")}`;
}

/** Step buttons for one request, like KING 253 (Approve / Reject / Received / Complete / Delete). */
function ReturnActions({ r }: { r: ReturnItem }) {
  const { busy, run } = useAction();
  const confirm = useConfirm();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [managerNote, setManagerNote] = useState(r.managerNote ?? "");
  const go = (status: string, msg: string) => run(() => api(`/api/admin/returns/${r.id}`, { method: "PATCH", json: { status, note: note || undefined } }), msg);
  const can = (s: string) => r.next.includes(s);
  const exchange = r.type === "EXCHANGE";
  return (
    <div className="flex flex-col gap-2">
      {r.next.length > 0 && <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note (facultatif)" aria-label="Note" className={cn(inp, "w-full")} />}
      <div className="flex flex-wrap gap-2">
        {can("APPROVED") && <Button size="sm" variant="gold" loading={busy} onClick={() => go("APPROVED", "Demande approuvée.")}>Approuver{exchange ? " l'échange" : " le retour"}</Button>}
        {can("UNDER_REVIEW") && <Button size="sm" variant="outline" disabled={busy} onClick={() => go("UNDER_REVIEW", "Demande en étude.")}>Mettre en étude</Button>}
        {can("REJECTED") && <Button size="sm" variant="outline" disabled={busy} onClick={() => go("REJECTED", "Demande refusée.")}>Refuser</Button>}
        {can("RETURN_RECEIVED") && <Button size="sm" variant="outline" disabled={busy} onClick={() => go("RETURN_RECEIVED", "Article reçu.")}>Article reçu</Button>}
        {can("EXCHANGE_PROCESSING") && <Button size="sm" variant="outline" disabled={busy} onClick={() => go("EXCHANGE_PROCESSING", "Fabrication de la nouvelle pièce.")}>Fabriquer la nouvelle pièce</Button>}
        {can("COMPLETED") && (
          <Button size="sm" variant="gold" disabled={busy} onClick={() => go("COMPLETED", "Demande terminée.")}>
            Terminer{exchange ? " — nouvelle pièce remise" : ""}
          </Button>
        )}
        {can("CANCELLED") && r.status !== "REQUESTED" && <Button size="sm" variant="ghost" disabled={busy} onClick={() => go("CANCELLED", "Demande annulée.")}>Annuler</Button>}
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            if (!(await confirm({ title: "Supprimer cette demande ?", message: "Elle disparaît de la commande et de la liste des retours. La commande et son prix ne changent pas.", confirmLabel: "Supprimer", danger: true }))) return;
            await run(() => api(`/api/admin/returns/${r.id}`, { method: "DELETE" }), "Demande supprimée.");
            router.refresh();
          }}
        >
          Supprimer
        </Button>
      </div>
      <details className="text-xs text-stone">
        <summary className="cursor-pointer select-none">Note interne{r.managerNote ? " ·  1" : ""}</summary>
        <div className="mt-2 flex flex-col gap-2">
          <textarea rows={2} value={managerNote} onChange={(e) => setManagerNote(e.target.value)} maxLength={2000} aria-label="Note interne" className={cn(fieldClasses, "py-2 text-sm font-normal")} />
          <div>
            <Button size="sm" variant="outline" disabled={managerNote === (r.managerNote ?? "")} loading={busy} onClick={() => run(() => api(`/api/admin/returns/${r.id}`, { method: "PATCH", json: { status: r.status, managerNote } }), "Note enregistrée.")}>
              Enregistrer la note
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}

/** Record a return or exchange for a delivered order (customer called or came back). */
function AdminReturnForm({ orderId, items, products }: { orderId: string; items: ReturnableItem[]; products: ExchangeProduct[] }) {
  const { busy, run } = useAction();
  const returnable = items.filter((i) => i.returnable > 0);
  const [open, setOpen] = useState(false);
  const first = returnable[0];
  const [v, setV] = useState({
    itemId: first?.id ?? "",
    type: "EXCHANGE" as "RETURN" | "EXCHANGE",
    quantity: 1,
    reason: "WRONG_SIZE",
    details: "",
    productId: first?.productId ?? products[0]?.id ?? "",
    w: "",
    h: "",
    frameId: "",
    extraIds: [] as string[],
    approve: true,
  });
  const [preview, setPreview] = useState<{ key: string; type: string | null; price: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const item = returnable.find((i) => i.id === v.itemId) ?? first;

  if (!returnable.length) return <p className="text-sm text-stone">Chaque article de cette commande est déjà couvert par un retour ou un échange.</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 self-start rounded-full border border-ivory/35 px-4 text-[13px] font-semibold hover:border-ivory">
        <RotateCcw className="size-3.5" /> Enregistrer un retour ou un échange
      </button>
    );
  }

  const product = products.find((p) => p.id === v.productId);
  const w = Number(v.w);
  const h = Number(v.h);
  const dimsOk = Number.isInteger(w) && w > 0 && Number.isInteger(h) && h > 0;
  const key = JSON.stringify([v.productId, w, h, v.frameId, [...v.extraIds].sort()]);
  const check = async () => {
    setError(null);
    try {
      const r = await api<{ available: boolean; quote?: { pricingType: string; unitPrice: number } }>("/api/pricing/quote", {
        method: "POST",
        json: { productId: v.productId, widthCm: w, heightCm: h, frameId: v.frameId || null, extraIds: v.extraIds, quantity: 1 },
      });
      setPreview({ key, type: r.available ? r.quote!.pricingType : null, price: r.available ? r.quote!.unitPrice : null });
    } catch (e) {
      setError(errText(e));
    }
  };
  const shown = preview?.key === key ? preview : null;

  return (
    <form
      className="flex flex-col gap-4 rounded-field border border-line bg-umber-900/40 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (v.type === "EXCHANGE" && (!v.productId || !dimsOk)) return setError("Choisissez ce que le client prend à la place (produit et mesure).");
        const ok = await run(
          () =>
            api(`/api/admin/orders/${orderId}/returns`, {
              method: "POST",
              json: {
                type: v.type,
                orderItemId: item.id,
                quantity: v.quantity,
                reason: v.reason,
                details: v.details || undefined,
                replacement: v.type === "EXCHANGE" ? { productId: v.productId, widthCm: w, heightCm: h, frameId: v.frameId || null, extraIds: v.extraIds } : null,
                approve: v.approve,
              },
            }),
          v.type === "EXCHANGE" ? "Échange enregistré." : "Retour enregistré.",
        );
        if (ok) setOpen(false);
      }}
    >
      <div className="flex flex-wrap gap-2">
        {(["EXCHANGE", "RETURN"] as const).map((t) => (
          <button key={t} type="button" aria-pressed={v.type === t} onClick={() => setV({ ...v, type: t })} className={pill(v.type === t)}>
            {t === "EXCHANGE" ? "Échange (autre produit, mesure, cadre, options)" : "Retour (rendre l'article)"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <label className="flex flex-col gap-1 text-xs font-semibold text-sand">
          Article rendu
          <select value={item.id} onChange={(e) => { const it = returnable.find((i) => i.id === e.target.value); setV({ ...v, itemId: e.target.value, quantity: 1, productId: it?.productId ?? v.productId }); }} className={cn(inp, "w-full")}>
            {returnable.map((i) => (
              <option key={i.id} value={i.id}>{i.name} — {i.widthCm} × {i.heightCm} cm</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-sand">
          Quantité (max {item.returnable})
          <input type="number" min={1} max={item.returnable} value={v.quantity} onChange={(e) => setV({ ...v, quantity: Math.max(1, Math.min(item.returnable, Number(e.target.value) || 1)) })} className={cn(inp, "w-full")} />
        </label>
      </div>

      {v.type === "EXCHANGE" && (
        <fieldset className="flex flex-col gap-3 rounded-field border border-line p-3">
          <legend className="px-1 text-xs font-semibold text-sand">Le client prend à la place</legend>
          <label className="flex flex-col gap-1 text-xs font-semibold text-sand">
            Produit
            <select value={v.productId} onChange={(e) => setV({ ...v, productId: e.target.value, w: "", h: "", frameId: "", extraIds: [] })} className={cn(inp, "w-full")}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === item.productId ? " (même produit)" : ""}</option>)}
            </select>
          </label>
          {product && product.measures.length > 0 && (
            <select
              aria-label="Mesure proposée"
              value={product.measures.some((m) => m.widthCm === w && m.heightCm === h) ? `${w}x${h}` : ""}
              onChange={(e) => { const [mw, mh] = e.target.value.split("x"); setV({ ...v, w: mw ?? "", h: mh ?? "" }); }}
              className={cn(inp, "w-full")}
            >
              <option value="">{product.surMesure ? "Mesure proposée… (ou Sur Mesure ci-dessous)" : "Mesure proposée…"}</option>
              {product.measures.map((m) => <option key={`${m.widthCm}x${m.heightCm}`} value={`${m.widthCm}x${m.heightCm}`}>{m.widthCm} × {m.heightCm} cm{m.label ? ` — ${m.label}` : ""}</option>)}
            </select>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-sand">Longueur (cm)<input type="number" min={1} value={v.w} onChange={(e) => setV({ ...v, w: e.target.value })} className={cn(inp, "w-28 tabular-nums")} /></label>
            <span className="pb-2 text-stone">×</span>
            <label className="flex flex-col gap-1 text-xs font-semibold text-sand">Hauteur (cm)<input type="number" min={1} value={v.h} onChange={(e) => setV({ ...v, h: e.target.value })} className={cn(inp, "w-28 tabular-nums")} /></label>
          </div>
          {product && product.frames.length > 0 && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-sand">
              Cadre
              <select value={v.frameId} onChange={(e) => setV({ ...v, frameId: e.target.value })} className={cn(inp, "w-full")}>
                <option value="">Sans cadre</option>
                {product.frames.map((f) => <option key={f.id} value={f.id}>{f.name} (+ {formatPrice(f.price, "fr")})</option>)}
              </select>
            </label>
          )}
          {product && product.extras.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {product.extras.map((x) => (
                <label key={x.id} className={pill(v.extraIds.includes(x.id))}>
                  <input type="checkbox" className="sr-only" checked={v.extraIds.includes(x.id)} onChange={(e) => setV({ ...v, extraIds: e.target.checked ? [...v.extraIds, x.id] : v.extraIds.filter((y) => y !== x.id) })} />
                  {x.name} (+ {formatPrice(x.price, "fr")})
                </label>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="outline" disabled={!dimsOk || !v.productId} onClick={check}>Voir le prix</Button>
            {shown && shown.price != null && (
              <p className="text-xs text-gold">
                {shown.type === "SUR_MESURE" ? "Sur Mesure" : "Mesure proposée"} : {formatPrice(shown.price, "fr")} l&apos;unité (options comprises) · commandé {formatPrice(item.unitPrice, "fr")} · {priceDiff(shown.price - item.unitPrice)}
              </p>
            )}
            {shown && shown.price == null && <p className="text-xs text-stone">Pas de prix en ligne pour cette mesure : à chiffrer avec le client.</p>}
          </div>
          <p className="text-xs text-stone">Information seulement : le prix de la commande ne change pas. La différence est comptée dans le chiffre d&apos;affaires quand l&apos;échange est terminé.</p>
        </fieldset>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-sand">
          Motif
          <select value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} className={cn(inp, "w-full")}>
            {REASONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-sand">
          Détails (facultatif)
          <textarea rows={1} value={v.details} onChange={(e) => setV({ ...v, details: e.target.value })} maxLength={2000} className={cn(fieldClasses, "min-h-10 py-2 text-sm font-normal")} />
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm text-sand">
        <input type="checkbox" checked={v.approve} onChange={(e) => setV({ ...v, approve: e.target.checked })} className="mt-1 size-4 accent-[var(--color-gold)]" />
        <span>
          Approuver maintenant{v.type === "EXCHANGE" ? " — la nouvelle pièce peut être lancée tout de suite" : ""}.
          <span className="block text-xs text-stone">Ensuite : « Article reçu » quand la pièce revient, {v.type === "EXCHANGE" ? "« Fabriquer la nouvelle pièce », " : ""}puis « Terminer ».</span>
        </span>
      </label>

      {error && <p className="text-xs text-ember">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="gold" loading={busy}>Enregistrer {v.type === "EXCHANGE" ? "l'échange" : "le retour"}</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
      </div>
    </form>
  );
}

export function ReturnsPanel({ orderId, delivered, items, products, requests }: { orderId: string; delivered: boolean; items: ReturnableItem[]; products: ExchangeProduct[]; requests: ReturnItem[] }) {
  return (
    <div className="flex flex-col gap-4">
      {requests.length > 0 && (
        <ul className="flex flex-col gap-3">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 rounded-field border border-line bg-umber-950/30 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  {RETURN_TYPE_FR[r.type]} × {r.quantity}
                  <span className="ms-2 text-xs font-normal text-stone">{r.source === "ADMIN" ? "enregistrée par un gestionnaire" : "demandée par le client"} · {r.createdAt}</span>
                </span>
                <span className="rounded-full bg-ivory/8 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-sand">{RETURN_STATUS_FR[r.status]}</span>
              </div>
              {r.item && (
                <p className="text-sand">
                  {r.item.name} — {r.item.widthCm} × {r.item.heightCm} cm
                  {r.replacement && (
                    <>
                      {" "}→{" "}
                      <strong className="text-ivory">
                        {r.replacement.productName && r.replacement.productName !== r.item.name ? `${r.replacement.productName} — ` : ""}
                        {r.replacement.widthCm} × {r.replacement.heightCm} cm
                        {r.replacement.frameName ? ` · ${r.replacement.frameName}` : ""}
                        {r.replacement.extras.length ? ` · ${r.replacement.extras.join(", ")}` : ""}
                      </strong>
                      <span className="text-xs text-stone">
                        {" "}
                        ({r.replacement.price != null ? `${r.replacement.pricingType === "SUR_MESURE" ? "Sur Mesure" : "mesure proposée"} · ${formatPrice(r.replacement.price, "fr")} · ${priceDiff(r.replacement.price - r.item.unitPrice)}` : "prix à définir"})
                      </span>
                    </>
                  )}
                </p>
              )}
              <p className="text-xs text-stone">{r.reason}{r.details ? ` — ${r.details}` : ""}</p>
              <ReturnActions r={r} />
            </li>
          ))}
        </ul>
      )}
      {delivered ? <AdminReturnForm orderId={orderId} items={items} products={products} /> : requests.length === 0 && <p className="text-sm text-stone">Disponible une fois la commande livrée.</p>}
      <p className="text-xs text-stone">
        Les conditions affichées au client viennent de la page CMS « Politique de retours &amp; échanges ». Le prix enregistré de la commande n&apos;est jamais modifié par une demande.
      </p>
    </div>
  );
}

// ───────────────────────── Grouped delivery

export function SeparateDeliveryButton({ orderId }: { orderId: string }) {
  const { busy, run } = useAction();
  const confirm = useConfirm();
  return (
    <Button
      size="sm"
      variant="outline"
      loading={busy}
      onClick={async () => {
        if (await confirm({ title: "Livrer cette commande séparément ?", message: "Elle ne sera plus dans le même colis : ses frais de livraison sont recalculés selon le tarif de la wilaya.", confirmLabel: "Livrer séparément" }))
          await run(() => api(`/api/admin/orders/${orderId}/separate`, { method: "POST" }), "Livraison séparée.");
      }}
    >
      Livrer séparément
    </Button>
  );
}
