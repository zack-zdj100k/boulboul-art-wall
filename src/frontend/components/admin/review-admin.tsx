"use client";

import { Eye, EyeOff, Plus, Star, Trash2, X, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/frontend/components/ui/button";
import { Dialog } from "@/frontend/components/ui/dialog";
import { fieldClasses } from "@/frontend/components/ui/field";
import { useConfirm } from "@/frontend/components/ui/confirm";
import { useToast } from "@/frontend/components/ui/toast";
import { api } from "@/frontend/lib/api-client";
import { cn } from "@/shared/lib/utils";

export function ReviewActions({ id, status, isFeatured }: { id: string; status: string; isFeatured: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const act = async (body: Record<string, unknown>, method: "PATCH" | "DELETE" = "PATCH") => {
    if (method === "DELETE" && !(await confirm({ title: "Supprimer cet avis ?", message: "Suppression définitive.", confirmLabel: "Supprimer", danger: true }))) return;
    try {
      await api(`/api/admin/reviews/${id}`, { method, json: method === "PATCH" ? body : undefined });
      router.refresh();
    } catch {
      toast.show("Action impossible.", "error");
    }
  };
  const btn = "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition";
  return (
    <div className="flex flex-wrap gap-1.5">
      {status !== "APPROVED" && <button className={cn(btn, "border-sage/50 text-sage hover:bg-sage/10")} onClick={() => act({ status: "APPROVED" })}><Check className="size-3" /> Approuver</button>}
      {status !== "REJECTED" && <button className={cn(btn, "border-ember/50 text-ember hover:bg-ember/10")} onClick={() => act({ status: "REJECTED", isFeatured: false })}><X className="size-3" /> Rejeter</button>}
      {status === "APPROVED" && <button className={cn(btn, "border-line text-sand hover:text-ivory")} onClick={() => act({ status: "HIDDEN", isFeatured: false })}><EyeOff className="size-3" /> Masquer</button>}
      {status === "HIDDEN" && <button className={cn(btn, "border-line text-sand hover:text-ivory")} onClick={() => act({ status: "APPROVED" })}><Eye className="size-3" /> Réafficher</button>}
      {status === "APPROVED" && (
        <button className={cn(btn, isFeatured ? "border-gold bg-gold/15 text-gold" : "border-line text-sand hover:text-ivory")} onClick={() => act({ isFeatured: !isFeatured })} aria-pressed={isFeatured}>
          <Star className={cn("size-3", isFeatured && "fill-gold")} /> Accueil
        </button>
      )}
      <button className={cn(btn, "border-line text-stone hover:text-ember")} onClick={() => act({}, "DELETE")} aria-label="Supprimer"><Trash2 className="size-3" /></button>
    </div>
  );
}

export function AddReviewButton({ products }: { products: { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ productId: "", authorName: "", rating: 5, comment: "", isFeatured: false, confirmReal: false });
  const [saving, setSaving] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="size-4" /> Ajouter un avis réel</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Ajouter un avis client réel">
        <form
          className="flex flex-col gap-4 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              await api("/api/admin/reviews", { method: "POST", json: { ...form, productId: form.productId || null } });
              toast.show("Avis ajouté.", "success");
              setOpen(false);
              router.refresh();
            } catch {
              toast.show("Vérifiez le formulaire (et confirmez que l'avis est réel).", "error");
            } finally {
              setSaving(false);
            }
          }}
        >
          <p className="rounded-field border border-gold/40 bg-gold/10 p-3 text-xs text-sand">Uniquement pour transcrire un avis réellement reçu (message, réseaux sociaux…). N&apos;inventez jamais d&apos;avis.</p>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-sand">Nom du client<input required value={form.authorName} onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))} className={cn(fieldClasses, "h-11")} /></label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-sand">Produit (facultatif)
            <select value={form.productId} onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))} className={cn(fieldClasses, "h-11")}>
              <option value="">— Aucun —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-sand">Note
            <select value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: Number(e.target.value) }))} className={cn(fieldClasses, "h-11")}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-sand">Avis<textarea required minLength={5} rows={4} value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} className={cn(fieldClasses, "py-3")} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))} className="accent-[var(--color-gold)]" /> Afficher sur l&apos;accueil</label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" required checked={form.confirmReal} onChange={(e) => setForm((f) => ({ ...f, confirmReal: e.target.checked }))} className="accent-[var(--color-gold)]" /> Je confirme qu&apos;il s&apos;agit d&apos;un avis réel</label>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" loading={saving}>Ajouter</Button></div>
        </form>
      </Dialog>
    </>
  );
}
