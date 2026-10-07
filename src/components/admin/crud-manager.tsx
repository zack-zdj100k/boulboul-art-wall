"use client";

import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { fieldClasses } from "@/components/ui/field";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ImageField, type PickedMedia } from "./media-picker";
import { Empty } from "./ui";

export type CrudField =
  | { key: string; label: string; type: "text" | "textarea" | "number" | "color"; help?: string; required?: boolean; dir?: "rtl" | "ltr" }
  | { key: string; label: string; type: "checkbox"; help?: string }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; help?: string }
  | { key: string; label: string; type: "image"; previewKey: string; help?: string }
  | { key: string; label: string; type: "colors"; help?: string };

type ColorRow = { name: string; hex: string };

/** Editable list of named colours (name + picker), e.g. LED tones offered to customers. */
function ColorsEditor({ value, onChange }: { value: ColorRow[]; onChange: (v: ColorRow[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {value.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="color" aria-label={`Couleur ${i + 1}`} value={c.hex} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} className="h-10 w-12 shrink-0 rounded-md border border-line-strong bg-transparent" />
          <input aria-label={`Nom de la couleur ${i + 1}`} value={c.name} placeholder="ex. Blanc chaud" maxLength={40} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={cn(fieldClasses, "h-10 flex-1")} />
          <button type="button" aria-label="Retirer la couleur" onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid size-9 shrink-0 place-items-center rounded-full text-sand hover:bg-ember/15 hover:text-ember">
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      <div>
        <Button size="sm" variant="outline" onClick={() => onChange([...value, { name: "", hex: "#ffd9a0" }])}>
          <Plus className="size-3.5" /> Ajouter une couleur
        </Button>
      </div>
    </div>
  );
}

type Item = Record<string, unknown> & { id: string };

const ERRORS: Record<string, string> = {
  "admin.slugTaken": "Ce slug est déjà utilisé.",
  "validation.wilaya": "Wilaya invalide.",
  "admin.communeNeedsWilaya": "Une règle par commune doit préciser la wilaya.",
};

/** Generic list + create/edit dialog + delete, backed by /api/admin/<resource>. */
export function CrudManager({
  endpoint,
  items,
  fields,
  defaults,
  columns,
  itemLabel,
  deleteWarning,
  searchText,
  searchPlaceholder,
  pageSize,
}: {
  endpoint: string;
  items: Item[];
  fields: CrudField[];
  defaults: Record<string, unknown>;
  columns: { label: string; render: (item: Item) => ReactNode }[];
  itemLabel: string;
  deleteWarning?: string;
  /** Text an item is searched by (shows a search box). */
  searchText?: (item: Item) => string;
  searchPlaceholder?: string;
  /** Show only this many rows until "Voir tout" is clicked. */
  pageSize?: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ id: string | null; values: Record<string, unknown> } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const matched = searchText && query.trim() ? items.filter((i) => norm(searchText(i)).includes(norm(query.trim()))) : items;
  const limited = pageSize && !showAll && !query.trim() ? matched.slice(0, pageSize) : matched;

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setErrors({});
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      const v = editing.values[f.key];
      body[f.key] =
        f.type === "number"
          ? v === "" || v == null ? null : Number(v)
          : f.type === "checkbox"
            ? !!v
            : f.type === "colors"
              ? ((v as ColorRow[]) ?? []).filter((c) => c.name.trim())
              : v ?? "";
    }
    try {
      await api(editing.id ? `${endpoint}/${editing.id}` : endpoint, { method: editing.id ? "PUT" : "POST", json: body });
      toast.show("Enregistré.", "success");
      setEditing(null);
      router.refresh();
    } catch (e) {
      const err = e as ApiError;
      setErrors(err.fields ?? {});
      toast.show(ERRORS[err.code] ?? "Vérifiez les champs du formulaire.", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: Item) => {
    const ok = await confirm({ title: `Supprimer ${String(item.name ?? itemLabel)} ?`, message: `Suppression définitive. ${deleteWarning ?? ""}`, confirmLabel: "Supprimer", danger: true });
    if (!ok) return;
    try {
      await api(`${endpoint}/${item.id}`, { method: "DELETE" });
      toast.show("Supprimé.", "success");
      router.refresh();
    } catch {
      toast.show("Suppression impossible.", "error");
    }
  };

  const setValue = (k: string, v: unknown) => setEditing((e) => (e ? { ...e, values: { ...e.values, [k]: v } } : e));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => setEditing({ id: null, values: { ...defaults } })}>
          <Plus className="size-4" /> Ajouter {itemLabel}
        </Button>
        {searchText && items.length > 0 && (
          <label className="relative min-w-0 basis-full sm:flex-1 sm:basis-auto sm:max-w-xs">
            <span className="sr-only">Rechercher</span>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-stone" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder ?? "Rechercher…"} className={cn(fieldClasses, "h-9 ps-9 text-sm")} />
          </label>
        )}
      </div>
      {items.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line">
          {/* Column headings (desktop); on mobile each value carries its own small label. */}
          <li aria-hidden className="hidden items-center gap-4 bg-umber-900 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-stone sm:flex">
            {columns.map((c, i) => (
              <span key={c.label} className={i === 0 ? "min-w-0 flex-1" : "w-28 shrink-0"}>{c.label}</span>
            ))}
            <span className="w-[76px] shrink-0" />
          </li>
          {limited.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-ink/50 px-4 py-3 text-sm sm:flex-nowrap">
              {columns.map((c, i) =>
                i === 0 ? (
                  <div key={c.label} className="order-1 min-w-0 basis-[calc(100%-92px)] sm:order-none sm:flex-1 sm:basis-auto">
                    {c.render(item)}
                  </div>
                ) : (
                  <div key={c.label} className="order-3 min-w-0 text-sand sm:order-none sm:w-28 sm:shrink-0">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-stone sm:hidden">{c.label}</span>
                    {c.render(item)}
                  </div>
                ),
              )}
              <div className="order-2 ms-auto flex shrink-0 gap-1 sm:order-none sm:ms-0">
                <button type="button" onClick={() => setEditing({ id: item.id, values: { ...item } })} className="grid size-9 place-items-center rounded-full text-sand hover:bg-ivory/8 hover:text-ivory" aria-label="Modifier">
                  <Pencil className="size-4" />
                </button>
                <button type="button" onClick={() => remove(item)} className="grid size-9 place-items-center rounded-full text-sand hover:bg-ember/15 hover:text-ember" aria-label="Supprimer">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
          {matched.length === 0 && <li className="bg-ink/50 px-4 py-6 text-center text-sm text-sand">Aucun résultat.</li>}
        </ul>
      ) : (
        <Empty>Aucun élément pour le moment.</Empty>
      )}
      {pageSize && !query.trim() && matched.length > pageSize && (
        <div>
          <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Réduire la liste" : `Voir tout (${matched.length})`}
          </Button>
        </div>
      )}

      <Dialog open={!!editing} onClose={() => !saving && setEditing(null)} title={editing?.id ? `Modifier ${itemLabel}` : `Ajouter ${itemLabel}`} size="lg">
        {editing && (
          <form
            className="grid gap-4 p-6 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {fields.map((f) => {
              const v = editing.values[f.key];
              const err = errors[f.key];
              const wide = f.type === "textarea" || f.type === "image";
              if (f.type === "checkbox")
                return (
                  <label key={f.key} className="flex items-center gap-3 text-sm font-semibold sm:col-span-2">
                    <input type="checkbox" checked={!!v} onChange={(e) => setValue(f.key, e.target.checked)} className="size-4 accent-[var(--color-gold)]" /> {f.label}
                    {f.help && <span className="text-xs font-normal text-stone">— {f.help}</span>}
                  </label>
                );
              if (f.type === "colors")
                return (
                  <div key={f.key} className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[13px] font-semibold text-sand">{f.label}</span>
                    {f.help && <span className="text-xs text-stone">{f.help}</span>}
                    <ColorsEditor value={Array.isArray(v) ? (v as ColorRow[]) : []} onChange={(next) => setValue(f.key, next)} />
                    {err && <span role="alert" className="text-xs text-ember">Chaque couleur doit avoir un nom.</span>}
                  </div>
                );
              if (f.type === "image")
                return (
                  <div key={f.key} className="sm:col-span-2">
                    <ImageField
                      label={f.label}
                      value={v ? { id: String(v), url: String(editing.values[f.previewKey] ?? "") } : null}
                      onChange={(m: PickedMedia | null) => {
                        setValue(f.key, m?.id ?? "");
                        setValue(f.previewKey, m?.url ?? "");
                      }}
                    />
                  </div>
                );
              return (
                <label key={f.key} className={cn("flex flex-col gap-1.5 text-[13px] font-semibold text-sand", wide && "sm:col-span-2")}>
                  {f.label}
                  {f.type === "select" ? (
                    <select value={String(v ?? "")} onChange={(e) => setValue(f.key, e.target.value)} className={cn(fieldClasses, "h-11")}>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea value={String(v ?? "")} onChange={(e) => setValue(f.key, e.target.value)} rows={3} className={cn(fieldClasses, "py-2")} dir={"dir" in f ? f.dir : undefined} />
                  ) : f.type === "color" ? (
                    <span className="flex gap-2">
                      <input type="color" value={String(v || "#000000")} onChange={(e) => setValue(f.key, e.target.value)} className="h-11 w-14 rounded-field border border-line-strong bg-transparent" />
                      <input value={String(v ?? "")} onChange={(e) => setValue(f.key, e.target.value)} className={cn(fieldClasses, "h-11")} placeholder="#000000" />
                    </span>
                  ) : (
                    <input type={f.type} value={v == null ? "" : String(v)} onChange={(e) => setValue(f.key, e.target.value)} required={"required" in f && f.required} dir={"dir" in f ? f.dir : undefined} className={cn(fieldClasses, "h-11")} />
                  )}
                  {f.help && <span className="text-xs font-normal text-stone">{f.help}</span>}
                  {err && <span role="alert" className="text-xs text-ember">{ERRORS[err] ?? "Valeur invalide."}</span>}
                </label>
              );
            })}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Annuler</Button>
              <Button type="submit" loading={saving}>Enregistrer</Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
