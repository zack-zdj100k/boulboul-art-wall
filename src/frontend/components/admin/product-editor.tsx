"use client";

import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Badge } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { fieldClasses } from "@/frontend/components/ui/field";
import { useConfirm } from "@/frontend/components/ui/confirm";
import { useToast } from "@/frontend/components/ui/toast";
import { formatPrice } from "@/shared/i18n/config";
import { api, ApiError } from "@/frontend/lib/api-client";
import { cn } from "@/shared/lib/utils";
import { MediaPicker } from "./media-picker";

type Option = { id: string; name: string; price: number; isActive: boolean };

export type ProductFormValue = {
  name: string; nameAr: string; slug: string;
  description: string; descriptionAr: string;
  categoryId: string; status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  isFeatured: boolean; freeDelivery: boolean; isDemo: boolean; sortOrder: string;
  promoType: "" | "PERCENT" | "FIXED"; promoValue: string; promoStartsAt: string; promoEndsAt: string;
  productionNote: string; productionNoteAr: string; materials: string; weightKg: string; depthCm: string; colors: string; characteristics: string;
  seoTitle: string; seoDescription: string;
  images: { mediaId: string; url: string; alt: string }[];
  frames: { frameId: string; priceOverride: string; isDefault: boolean }[];
  extras: { extraId: string; priceOverride: string }[];
};

const ERRORS: Record<string, string> = {
  "admin.invalidMedia": "Une image sélectionnée est invalide.",
  "admin.invalidFrame": "Un cadre sélectionné est invalide.",
  "admin.invalidExtra": "Une option sélectionnée est invalide.",
};

function Section({ title, children, description }: { title: string; children: ReactNode; description?: string }) {
  return (
    <section className="rounded-panel border border-line bg-ink/60 p-5 md:p-6">
      <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-sand">{title}</h2>
      {description && <p className="mt-1 text-xs text-stone">{description}</p>}
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}

function L({ label, children, help, className }: { label: string; children: ReactNode; help?: string; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-[13px] font-semibold text-sand", className)}>
      {label}
      {children}
      {help && <span className="text-xs font-normal text-stone">{help}</span>}
    </label>
  );
}

const inp = cn(fieldClasses, "h-11 font-normal");
const n = (v: string) => (v === "" ? null : Number(v));

export function ProductEditor({ id, initial, categories, frames, extras }: { id: string | null; initial: ProductFormValue; categories: { id: string; name: string }[]; frames: Option[]; extras: Option[] }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [v, setV] = useState(initial);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ProductFormValue>(k: K, val: ProductFormValue[K]) => setV((x) => ({ ...x, [k]: val }));

  const payload = () => ({
    ...v,
    sortOrder: Number(v.sortOrder || 0),
    promoType: v.promoType || null, promoValue: n(v.promoValue),
    promoStartsAt: v.promoStartsAt || null, promoEndsAt: v.promoEndsAt || null,
    weightKg: n(v.weightKg), depthCm: n(v.depthCm),
    colors: v.colors.split(",").map((c) => c.trim()).filter(Boolean),
    characteristics: v.characteristics.split("\n").map((c) => c.trim()).filter(Boolean),
    images: v.images.map((i) => ({ mediaId: i.mediaId, alt: i.alt })),
    frames: v.frames.map((f) => ({ frameId: f.frameId, priceOverride: n(f.priceOverride), isDefault: f.isDefault })),
    extras: v.extras.map((e) => ({ extraId: e.extraId, priceOverride: n(e.priceOverride) })),
  });

  const save = async (statusOverride?: ProductFormValue["status"]) => {
    setSaving(true);
    setErrors({});
    try {
      const body = { ...payload(), ...(statusOverride ? { status: statusOverride } : {}) };
      const res = await api<{ id: string }>(id ? `/api/admin/products/${id}` : "/api/admin/products", { method: id ? "PUT" : "POST", json: body });
      toast.show("Produit enregistré.", "success");
      if (!id) router.replace(`/admin/products/${res.id}#tarification`);
      else router.refresh();
    } catch (e) {
      const err = e as ApiError;
      setErrors(err.fields ?? {});
      toast.show(ERRORS[err.code] ?? "Vérifiez les champs signalés.", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (permanent: boolean) => {
    if (!id) return;
    const ok = await confirm(
      permanent
        ? {
            title: "Supprimer définitivement ce produit ?",
            message: "Il disparaîtra du site et de l'administration. Les commandes passées gardent leurs informations (nom, dimensions, prix). Pour seulement le masquer, utilisez « Archiver ».",
            confirmLabel: "Supprimer",
            danger: true,
          }
        : { title: "Archiver ce produit ?", message: "Il ne sera plus visible ni commandable. Les commandes passées restent intactes.", confirmLabel: "Archiver" },
    );
    if (!ok) return;
    try {
      await api(`/api/admin/products/${id}${permanent ? "?permanent=1" : ""}`, { method: "DELETE" });
      toast.show(permanent ? "Produit supprimé." : "Produit archivé.", "success");
      router.push("/admin/products");
      router.refresh();
    } catch (e) {
      toast.show(ERRORS[(e as ApiError).code] ?? "Action impossible.", "error");
    }
  };

  const fieldError = (k: string) => errors[k] && <span className="text-xs font-normal text-ember">{errors[k].startsWith("validation.") ? "Valeur invalide." : errors[k]}</span>;
  const frameSel = (fid: string) => v.frames.find((f) => f.frameId === fid);
  const extraSel = (eid: string) => v.extras.find((e) => e.extraId === eid);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-6"
    >
      <div className="sticky top-[57px] z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-umber-950/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8 lg:top-0 lg:-mx-10 lg:px-10">
        <div className="flex items-center gap-2 text-sm">
          <Badge tone={v.status === "ACTIVE" ? "sage" : v.status === "ARCHIVED" ? "ember" : "outline"}>{v.status === "ACTIVE" ? "En ligne" : v.status === "ARCHIVED" ? "Archivé" : "Brouillon"}</Badge>
          {v.isDemo && <Badge tone="demo">Démo</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          {id && v.status !== "ARCHIVED" && <Button variant="ghost" size="sm" onClick={() => remove(false)}>Archiver</Button>}
          {id && <Button variant="ghost" size="sm" onClick={() => remove(true)}><Trash2 className="size-3.5" /> Supprimer</Button>}
          <Button type="submit" size="sm" loading={saving}>Enregistrer</Button>
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-6">
          <Section title="Informations">
            <div className="grid gap-4 sm:grid-cols-2">
              <L label="Nom (FR) *">{<input required value={v.name} onChange={(e) => set("name", e.target.value)} className={inp} />}{fieldError("name")}</L>
              <L label="Slug (URL)" help="Vide : généré depuis le nom.">{<input value={v.slug} onChange={(e) => set("slug", e.target.value)} className={inp} placeholder="ex. canvas-life-goes-on" />}{fieldError("slug")}</L>
              <L label="Nom (AR)"><input dir="rtl" value={v.nameAr} onChange={(e) => set("nameAr", e.target.value)} className={inp} /></L>
            </div>
            <L label="Description (FR)"><textarea rows={5} value={v.description} onChange={(e) => set("description", e.target.value)} className={cn(fieldClasses, "py-3 font-normal")} /></L>
            <div className="grid gap-4">
              <L label="Description (AR)"><textarea dir="rtl" rows={4} value={v.descriptionAr} onChange={(e) => set("descriptionAr", e.target.value)} className={cn(fieldClasses, "py-3 font-normal")} /></L>
            </div>
          </Section>

          <Section title="Images" description="La première image est l'image principale ; la seconde s'affiche au survol des cartes.">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {v.images.map((img, i) => (
                <li key={img.mediaId + i} className="flex flex-col gap-2 rounded-field border border-line p-2">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-art bg-umber-800">
                    <Image src={img.url} alt={img.alt} fill sizes="200px" className="object-cover" />
                    {i === 0 && <span className="absolute start-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-ink">Principale</span>}
                  </div>
                  <input value={img.alt} placeholder="Texte alternatif" aria-label="Texte alternatif" onChange={(e) => set("images", v.images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} className="h-8 rounded-md border border-line bg-umber-900 px-2 text-xs" />
                  <div className="flex justify-between">
                    <span className="flex gap-1">
                      <button type="button" aria-label="Avancer" disabled={i === 0} onClick={() => { const a = [...v.images]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set("images", a); }} className="grid size-7 place-items-center rounded-full text-sand hover:bg-ivory/8 disabled:opacity-30"><ArrowUp className="size-3.5 -rotate-90" /></button>
                      <button type="button" aria-label="Reculer" disabled={i === v.images.length - 1} onClick={() => { const a = [...v.images]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; set("images", a); }} className="grid size-7 place-items-center rounded-full text-sand hover:bg-ivory/8 disabled:opacity-30"><ArrowDown className="size-3.5 -rotate-90" /></button>
                    </span>
                    <button type="button" aria-label="Retirer" onClick={() => set("images", v.images.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-full text-sand hover:text-ember"><Trash2 className="size-3.5" /></button>
                  </div>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => setPickerOpen(true)} className="grid aspect-[4/5] w-full place-items-center rounded-field border-2 border-dashed border-line-strong text-sand hover:border-ivory/40">
                  <span className="flex flex-col items-center gap-2 text-xs font-semibold"><ImagePlus className="size-6" /> Ajouter</span>
                </button>
              </li>
            </ul>
            <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} multiple onPick={(m) => set("images", [...v.images, ...m.map((x) => ({ mediaId: x.id, url: x.url, alt: x.alt ?? "" }))])} />
          </Section>

          <Section title="Cadres & options" description="Suppléments à prix fixe, ajoutés au prix du produit. Ils ne dépendent jamais des dimensions.">
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-sand">Cadres disponibles</span>
              {frames.length === 0 && <p className="text-xs text-stone">Aucun cadre — créez-en dans Paramètres.</p>}
              {frames.map((f) => {
                const sel = frameSel(f.id);
                return (
                  <div key={f.id} className={cn("flex flex-wrap items-center gap-3 rounded-field border px-3 py-2 text-sm", sel ? "border-gold/50 bg-gold/5" : "border-line")}>
                    <label className="flex flex-1 items-center gap-3">
                      <input type="checkbox" checked={!!sel} onChange={(e) => set("frames", e.target.checked ? [...v.frames, { frameId: f.id, priceOverride: "", isDefault: v.frames.length === 0 }] : v.frames.filter((x) => x.frameId !== f.id))} className="size-4 accent-[var(--color-gold)]" />
                      <span className="font-semibold">{f.name}</span>
                      <span className="text-xs text-stone">+ {formatPrice(f.price, "fr")}{!f.isActive && " · inactif"}</span>
                    </label>
                    {sel && (
                      <>
                        <input type="number" placeholder="Prix spécifique" aria-label={`Prix spécifique ${f.name}`} value={sel.priceOverride} onChange={(e) => set("frames", v.frames.map((x) => (x.frameId === f.id ? { ...x, priceOverride: e.target.value } : x)))} className="h-9 w-36 rounded-md border border-line bg-umber-900 px-2 text-xs" />
                        <label className="flex items-center gap-1.5 text-xs"><input type="radio" name="defaultFrame" checked={sel.isDefault} onChange={() => set("frames", v.frames.map((x) => ({ ...x, isDefault: x.frameId === f.id })))} className="accent-[var(--color-gold)]" /> Par défaut</label>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-sand">Options</span>
              {extras.length === 0 && <p className="text-xs text-stone">Aucune option — créez-en dans Paramètres.</p>}
              {extras.map((x) => {
                const sel = extraSel(x.id);
                return (
                  <div key={x.id} className={cn("flex flex-wrap items-center gap-3 rounded-field border px-3 py-2 text-sm", sel ? "border-gold/50 bg-gold/5" : "border-line")}>
                    <label className="flex flex-1 items-center gap-3">
                      <input type="checkbox" checked={!!sel} onChange={(e) => set("extras", e.target.checked ? [...v.extras, { extraId: x.id, priceOverride: "" }] : v.extras.filter((y) => y.extraId !== x.id))} className="size-4 accent-[var(--color-gold)]" />
                      <span className="font-semibold">{x.name}</span>
                      <span className="text-xs text-stone">{formatPrice(x.price, "fr")}</span>
                    </label>
                    {sel && <input type="number" placeholder="Prix spécifique" aria-label={`Prix spécifique ${x.name}`} value={sel.priceOverride} onChange={(e) => set("extras", v.extras.map((y) => (y.extraId === x.id ? { ...y, priceOverride: e.target.value } : y)))} className="h-9 w-36 rounded-md border border-line bg-umber-900 px-2 text-xs" />}
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Caractéristiques" description="Ne renseignez que des informations réelles ; les champs vides ne sont pas affichés.">
            <div className="grid gap-4 sm:grid-cols-3">
              <L label="Fabrication / délai (FR)" className="sm:col-span-3" help="Affiché sur la page produit (« Fabrication »). Vide = « Fabriqué à la commande ». Ex. « Prêt en 5 à 7 jours », « En stock — expédié sous 48 h ».">
                <input value={v.productionNote} onChange={(e) => set("productionNote", e.target.value)} maxLength={120} placeholder="Fabriqué à la commande" className={inp} />
              </L>
              <L label="Fabrication / délai (AR)" className="sm:col-span-3" help="Vide = « يُصنع حسب الطلب ».">
                <input dir="rtl" value={v.productionNoteAr} onChange={(e) => set("productionNoteAr", e.target.value)} maxLength={120} placeholder="يُصنع حسب الطلب" className={inp} />
              </L>
              <L label="Matériaux" className="sm:col-span-3"><input value={v.materials} onChange={(e) => set("materials", e.target.value)} className={inp} /></L>
              <L label="Poids (kg)"><input type="number" step="0.01" value={v.weightKg} onChange={(e) => set("weightKg", e.target.value)} className={inp} /></L>
              <L label="Épaisseur (cm)"><input type="number" step="0.1" value={v.depthCm} onChange={(e) => set("depthCm", e.target.value)} className={inp} /></L>
              <L label="Couleurs disponibles" help="Séparées par des virgules."><input value={v.colors} onChange={(e) => set("colors", e.target.value)} className={inp} /></L>
            </div>
            <L label="Points clés" help="Un par ligne."><textarea rows={4} value={v.characteristics} onChange={(e) => set("characteristics", e.target.value)} className={cn(fieldClasses, "py-3 font-normal")} /></L>
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section title="Publication">
            <L label="Statut">
              <select value={v.status} onChange={(e) => set("status", e.target.value as ProductFormValue["status"])} className={inp}>
                <option value="DRAFT">Brouillon (non visible)</option>
                <option value="ACTIVE">En ligne</option>
                <option value="ARCHIVED">Archivé</option>
              </select>
            </L>
            <L label="Catégorie">
              <select value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={inp}>
                <option value="">— Aucune —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </L>
            <L label="Ordre d'affichage"><input type="number" value={v.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} className={inp} /></L>
            <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={v.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} className="size-4 accent-[var(--color-gold)]" /> Mis en avant sur l&apos;accueil</label>
            <label className="flex items-start gap-3 text-sm font-semibold">
              <input type="checkbox" checked={v.freeDelivery} onChange={(e) => set("freeDelivery", e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-gold)]" />
              <span>
                Livraison offerte
                <span className="block text-xs font-normal text-stone">Badge « Livraison offerte » sur le produit. La commande est livrée gratuitement quand tous ses produits ont cette option.</span>
              </span>
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={v.isDemo} onChange={(e) => set("isDemo", e.target.checked)} className="size-4 accent-[var(--color-gold)]" /> Produit de démonstration <span className="text-xs font-normal text-stone">(prix indicatif)</span></label>
          </Section>

          <Section title="Promotion" description="S'applique au prix officiel trouvé dans les tableaux (standard ou Sur Mesure), jamais aux prix enregistrés des commandes passées.">
            <L label="Type">
              <select value={v.promoType} onChange={(e) => set("promoType", e.target.value as ProductFormValue["promoType"])} className={inp}>
                <option value="">Aucune</option>
                <option value="PERCENT">Pourcentage</option>
                <option value="FIXED">Montant fixe (DA)</option>
              </select>
            </L>
            {v.promoType && (
              <>
                <L label={v.promoType === "PERCENT" ? "Remise (%)" : "Remise (DA)"}><input type="number" min={0} value={v.promoValue} onChange={(e) => set("promoValue", e.target.value)} className={inp} />{fieldError("promoValue")}</L>
                <L label="Début (facultatif)"><input type="datetime-local" value={v.promoStartsAt} onChange={(e) => set("promoStartsAt", e.target.value)} className={inp} /></L>
                <L label="Fin (facultatif)"><input type="datetime-local" value={v.promoEndsAt} onChange={(e) => set("promoEndsAt", e.target.value)} className={inp} />{fieldError("promoEndsAt")}</L>
              </>
            )}
          </Section>

          <Section title="Référencement (SEO)">
            <L label="Titre SEO" help="70 caractères max."><input maxLength={70} value={v.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} className={inp} /></L>
            <L label="Description SEO" help="170 caractères max."><textarea maxLength={170} rows={3} value={v.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} className={cn(fieldClasses, "py-3 font-normal")} /></L>
          </Section>
        </div>
      </div>
    </form>
  );
}
