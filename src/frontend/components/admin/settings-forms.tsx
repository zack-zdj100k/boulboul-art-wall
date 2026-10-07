"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/frontend/components/ui/button";
import { fieldClasses } from "@/frontend/components/ui/field";
import { useConfirm } from "@/frontend/components/ui/confirm";
import { useToast } from "@/frontend/components/ui/toast";
import { api } from "@/frontend/lib/api-client";
import { cn } from "@/shared/lib/utils";

const LABELS: Record<string, { label: string; help: string }> = {
  "custom.minWidthCm": { label: "Largeur min. (cm)", help: "" },
  "custom.maxWidthCm": { label: "Largeur max. (cm)", help: "" },
  "custom.minHeightCm": { label: "Hauteur min. (cm)", help: "" },
  "custom.maxHeightCm": { label: "Hauteur max. (cm)", help: "" },
  "custom.refWidthCm": { label: "Longueur de référence (cm)", help: "Mesure du prix stable." },
  "custom.refHeightCm": { label: "Hauteur de référence (cm)", help: "" },
  "custom.refPrice": { label: "Prix de référence (DA)", help: "Prix stable à la mesure de référence. 0 = pas d'estimation affichée." },
  "custom.widthStepPrice": { label: "Longueur : ± DA par 10 cm", help: "+10 cm → + ce montant · −10 cm → − ce montant." },
  "custom.heightStepPrice": { label: "Hauteur : ± DA par 10 cm", help: "Ex. 200 : +10 cm sur les deux côtés = +400 DA." },
};

export function GeneralSettingsForm({ initial }: { initial: Record<string, number> }) {
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await api("/api/admin/settings", { method: "PUT", json: values });
          toast.show("Paramètres enregistrés.", "success");
        } catch {
          toast.show("Valeurs invalides.", "error");
        } finally {
          setSaving(false);
        }
      }}
    >
      {Object.keys(LABELS).map((k) => (
        <label key={k} className="flex flex-col gap-1.5 text-[13px] font-semibold text-sand">
          {LABELS[k].label}
          <input type="number" min={0} value={values[k] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [k]: Number(e.target.value) }))} className={cn(fieldClasses, "h-11")} />
          {LABELS[k].help && <span className="text-xs font-normal text-stone">{LABELS[k].help}</span>}
        </label>
      ))}
      <div className="sm:col-span-2">
        <Button type="submit" loading={saving}>Enregistrer</Button>
      </div>
    </form>
  );
}

export function PurgeDemoButton() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="danger"
      loading={loading}
      onClick={async () => {
        const ok = await confirm({
          title: "Supprimer les données de démonstration ?",
          message: "Produits, cadres, options, commandes et client marqués « Démo ». Les données réelles ne sont pas touchées.",
          confirmLabel: "Supprimer",
          danger: true,
        });
        if (!ok) return;
        setLoading(true);
        try {
          const r = await api<Record<string, number>>("/api/admin/demo", { method: "DELETE" });
          toast.show(`Supprimé : ${r.products} produits, ${r.orders} commandes, ${r.frames} cadres, ${r.extras} options.`, "success");
          router.refresh();
        } catch {
          toast.show("Échec de la suppression.", "error");
        } finally {
          setLoading(false);
        }
      }}
    >
      Supprimer les données de démonstration
    </Button>
  );
}

type EmailValues = { "email.adminRecipients": string; "email.fromName": string; "email.customerConfirmed": boolean; "email.customerDelivered": boolean };

/** Notification settings (KING 253 style): who gets the "new order" email, sender name, customer emails. */
export function EmailSettingsForm({ initial, fallbackAdmin, provider }: { initial: EmailValues; fallbackAdmin: string; provider: string }) {
  const toast = useToast();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const input = cn(fieldClasses, "h-11 font-normal");
  const toggle = (k: "email.customerConfirmed" | "email.customerDelivered", label: string, help: string) => (
    <label className="flex items-start gap-3 rounded-field border border-line p-4 text-sm">
      <input type="checkbox" checked={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.checked })} className="mt-0.5 size-4 accent-[var(--color-gold)]" />
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs text-stone">{help}</span>
      </span>
    </label>
  );
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await api("/api/admin/settings", { method: "PUT", json: v });
          toast.show("Notifications enregistrées.", "success");
          router.refresh();
        } catch {
          toast.show("Vérifiez les adresses e-mail (séparées par des virgules).", "error");
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-sand sm:col-span-2">
          E-mails qui reçoivent « Nouvelle commande »
          <input
            dir="ltr"
            value={v["email.adminRecipients"]}
            onChange={(e) => setV({ ...v, "email.adminRecipients": e.target.value })}
            placeholder={fallbackAdmin || "vous@exemple.com, associe@exemple.com"}
            className={input}
          />
          <span className="text-xs font-normal text-stone">
            Plusieurs adresses possibles, séparées par des virgules.{fallbackAdmin ? ` Vide : ${fallbackAdmin} (ADMIN_EMAIL).` : ""}
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-sand">
          Nom de l&apos;expéditeur
          <input value={v["email.fromName"]} maxLength={60} onChange={(e) => setV({ ...v, "email.fromName": e.target.value })} placeholder="Boulboul Art Wall" className={input} />
          <span className="text-xs font-normal text-stone">Le nom affiché dans la boîte de réception du client.</span>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {toggle("email.customerConfirmed", "E-mail au client : commande confirmée", "Envoyé quand la commande passe à « Confirmée » (prix final, livraison, total).")}
        {toggle("email.customerDelivered", "E-mail au client : commande livrée", "Envoyé une fois quand la commande passe à « Livrée », avec un lien vers sa commande (retour / échange).")}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={saving}>Enregistrer</Button>
        <Button
          variant="outline"
          loading={testing}
          onClick={async () => {
            setTesting(true);
            try {
              const r = await api<{ ok: boolean; to: string }>("/api/admin/settings/test-email", { method: "POST", json: {} });
              toast.show(provider === "log" ? `Test écrit dans storage/emails (mode développement) pour ${r.to}.` : `E-mail de test envoyé à ${r.to}.`, "success");
            } catch {
              toast.show("Échec de l'envoi — vérifiez la configuration (voir ci-dessous) et le destinataire.", "error");
            } finally {
              setTesting(false);
            }
          }}
        >
          Envoyer un e-mail de test
        </Button>
      </div>
    </form>
  );
}
