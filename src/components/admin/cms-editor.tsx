"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClasses } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import type { CmsField, CmsSectionDef } from "@/lib/cms-schema";
import { cn } from "@/lib/utils";
import { ImageField } from "./media-picker";

type Content = Record<string, unknown>;
type Lang = "fr" | "ar";
const LANGS: { key: Lang; label: string }[] = [
  { key: "fr", label: "Français" },
  { key: "ar", label: "العربية" },
];

function emptyFor(fields: CmsField[]): Content {
  return Object.fromEntries(fields.map((f) => [f.key, f.type === "list" ? [] : "localized" in f && f.localized ? { fr: "", ar: "" } : ""]));
}

function FieldsEditor({ fields, value, onChange, lang }: { fields: CmsField[]; value: Content; onChange: (v: Content) => void; lang: Lang }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-5">
      {fields.map((f) => {
        if (f.type === "image") {
          const url = typeof value[f.key] === "string" ? (value[f.key] as string) : "";
          return (
            <div key={f.key}>
              <ImageField label={f.label} value={url ? { id: url, url } : null} onChange={(m) => set(f.key, m?.url ?? "")} />
              {f.help && <p className="mt-1 text-xs text-stone">{f.help}</p>}
            </div>
          );
        }
        if (f.type === "list") {
          const items = Array.isArray(value[f.key]) ? (value[f.key] as Content[]) : [];
          const update = (next: Content[]) => set(f.key, next);
          return (
            <fieldset key={f.key} className="flex flex-col gap-3">
              <legend className="mb-2 text-[13px] font-bold uppercase tracking-[0.12em] text-sand">{f.label}</legend>
              {f.help && <p className="-mt-1 text-xs text-stone">{f.help}</p>}
              {items.map((item, i) => (
                <div key={i} className="rounded-panel border border-line bg-umber-900/50 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-bold text-gold">{f.itemLabel} {i + 1}</span>
                    <div className="flex gap-1">
                      <button type="button" aria-label="Monter" disabled={i === 0} onClick={() => { const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; update(n); }} className="grid size-8 place-items-center rounded-full text-sand hover:bg-ivory/8 disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                      <button type="button" aria-label="Descendre" disabled={i === items.length - 1} onClick={() => { const n = [...items]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; update(n); }} className="grid size-8 place-items-center rounded-full text-sand hover:bg-ivory/8 disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                      <button type="button" aria-label="Supprimer" onClick={() => update(items.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-full text-sand hover:bg-ember/15 hover:text-ember"><Trash2 className="size-3.5" /></button>
                    </div>
                  </div>
                  <FieldsEditor fields={f.fields} value={item} lang={lang} onChange={(v) => update(items.map((x, j) => (j === i ? v : x)))} />
                </div>
              ))}
              <div><Button size="sm" variant="outline" onClick={() => update([...items, emptyFor(f.fields)])}><Plus className="size-3.5" /> Ajouter : {f.itemLabel}</Button></div>
            </fieldset>
          );
        }
        const localized = "localized" in f && f.localized;
        const raw = value[f.key];
        const current = localized ? ((raw as Record<Lang, string>)?.[lang] ?? "") : typeof raw === "string" ? raw : "";
        const write = (v: string) => set(f.key, localized ? { ...(raw as object), [lang]: v } : v);
        const fallback = localized && lang !== "fr" ? (raw as Record<Lang, string>)?.fr : "";
        return (
          <label key={f.key} className="flex flex-col gap-1.5 text-[13px] font-semibold text-sand">
            <span>
              {f.label} {localized && <span className="ms-1 rounded bg-ivory/8 px-1.5 py-0.5 text-[10px] uppercase text-stone">{lang}</span>}
            </span>
            {f.type === "textarea" ? (
              <textarea value={current} onChange={(e) => write(e.target.value)} rows={f.key === "body" || f.key === "story" ? 14 : 4} dir={lang === "ar" && localized ? "rtl" : undefined} placeholder={fallback || undefined} className={cn(fieldClasses, "py-3 font-normal")} />
            ) : (
              <input value={current} onChange={(e) => write(e.target.value)} type={f.type === "url" ? "url" : "text"} dir={lang === "ar" && localized ? "rtl" : undefined} placeholder={fallback || (f.type === "url" ? "https://… ou /page" : undefined)} className={cn(fieldClasses, "h-11 font-normal")} />
            )}
            {f.help && <span className="text-xs font-normal text-stone">{f.help}</span>}
            {localized && lang !== "fr" && !current && fallback && <span className="text-xs font-normal text-stone">Vide : le texte français sera affiché.</span>}
          </label>
        );
      })}
    </div>
  );
}

export function CmsEditor({ def, initial, publishedAt, hasUnpublished }: { def: CmsSectionDef; initial: Content; publishedAt: string | null; hasUnpublished: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [content, setContent] = useState<Content>({ ...emptyFor(def.fields), ...initial });
  const [lang, setLang] = useState<Lang>("fr");
  const [saving, setSaving] = useState<null | "draft" | "publish">(null);
  const [dirty, setDirty] = useState(false);

  const save = async (publish: boolean) => {
    setSaving(publish ? "publish" : "draft");
    try {
      await api(`/api/admin/cms/${encodeURIComponent(def.key)}`, { method: "PUT", json: { content, publish } });
      toast.show(publish ? "Publié sur le site." : "Brouillon enregistré (non visible publiquement).", "success");
      setDirty(false);
      router.refresh();
    } catch {
      toast.show("Erreur lors de l'enregistrement.", "error");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-[57px] z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-umber-950/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8 lg:top-0 lg:-mx-10 lg:px-10">
        <div role="group" aria-label="Langue d'édition" className="flex gap-1 rounded-full border border-line p-1">
          {LANGS.map((l) => (
            <button key={l.key} type="button" onClick={() => setLang(l.key)} aria-pressed={lang === l.key} className={cn("rounded-full px-3 py-1.5 text-xs font-bold", lang === l.key ? "bg-ivory text-ink" : "text-sand")}>
              {l.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone">
            {dirty ? "Modifications non enregistrées" : hasUnpublished ? "Brouillon non publié" : publishedAt ? `Publié le ${new Date(publishedAt).toLocaleString("fr-DZ")}` : "Jamais publié"}
          </span>
          <Button size="sm" variant="outline" onClick={() => save(false)} loading={saving === "draft"} disabled={!!saving}>Enregistrer le brouillon</Button>
          <Button size="sm" variant="gold" onClick={() => save(true)} loading={saving === "publish"} disabled={!!saving}>Publier</Button>
        </div>
      </div>
      <div className="max-w-3xl">
        <FieldsEditor fields={def.fields} value={content} lang={lang} onChange={(v) => { setContent(v); setDirty(true); }} />
      </div>
    </div>
  );
}
