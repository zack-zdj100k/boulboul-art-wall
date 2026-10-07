"use client";

import { AlertTriangle, Calculator, Grid3x3, Pencil, Plus, Ruler, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { fieldClasses } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { formatPrice } from "@/i18n/config";
import { api, ApiError } from "@/lib/api-client";
import { calculateSurMesurePrice, findMeasure, isSurMesureConfigured, SUR_MESURE_STEP_CM, type SurMesureConfig } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export type MeasureRow = { id: string; widthCm: number; heightCm: number; price: number; isActive: boolean; label: string | null; description: string | null; updatedAt: string };

const ERRORS: Record<string, string> = {
  "pricing.duplicateDimension": "Cette mesure existe déjà pour ce produit.",
  "validation.invalid": "Valeurs invalides : dimensions et prix supérieurs à 0.",
};
const errMsg = (e: unknown) => ERRORS[(e as ApiError).code] ?? (Object.values((e as ApiError).fields ?? {})[0] as string | undefined) ?? "Action impossible.";

// Field look without the base `w-full`, so each input sets its own width (cn does not merge classes).
const inp = cn(fieldClasses.replace("w-full ", ""), "h-10 px-3 font-normal tabular-nums");
const STEP = SUR_MESURE_STEP_CM;
const range = (from: number, to: number) => {
  const out: number[] = [];
  for (let x = Math.ceil(from / STEP) * STEP; x <= to && out.length < 60; x += STEP) out.push(x);
  return out;
};
const toInt = (v: string) => (v.trim() === "" ? null : Number(v));
const p = (n: number) => formatPrice(n, "fr");
const signed = (n: number) => (n === 0 ? "0 DA" : `${n > 0 ? "+" : "−"} ${p(Math.abs(n))}`);

/**
 * Admin pricing of one product — two systems, clearly separated:
 *  A. "Mesures proposées": measures you create, each with its exact price (always first).
 *  B. "Sur Mesure": any other measure, priced from a stable reference ± a price per 10 cm.
 */
export function ProductPricingManager({ productId, measures, surMesure }: { productId: string; measures: MeasureRow[]; surMesure: SurMesureConfig }) {
  const [tab, setTab] = useState<"measures" | "surMesure">("measures");
  const active = measures.filter((r) => r.isActive).length;
  const smOn = isSurMesureConfigured(surMesure);
  return (
    <div className="flex flex-col gap-5">
      {active === 0 && !smOn && (
        <p className="flex items-start gap-3 rounded-panel border border-ember/50 bg-ember/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-ember" />
          <span>
            <strong>Aucun prix.</strong> Le site n&apos;affiche aucun prix pour ce produit et il ne peut pas être commandé. Créez au moins une mesure, ou activez le Sur Mesure.
          </span>
        </p>
      )}
      <div role="tablist" aria-label="Tarification" className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["measures", "1 · Prioritaire", "Mesures proposées", `${active} active(s) · ${measures.length} au total`],
            ["surMesure", "2 · Toute autre mesure", "Sur Mesure (prix calculé)", smOn ? `Actif · ${p(surMesure.refPrice!)} pour ${surMesure.refWidthCm} × ${surMesure.refHeightCm} cm` : "Inactif"],
          ] as const
        ).map(([key, kicker, label, sub]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            aria-controls={`pricing-${key}`}
            onClick={() => setTab(key)}
            className={cn("flex flex-col items-start gap-1 rounded-panel border p-4 text-start transition", tab === key ? "border-gold bg-gold/10 shadow-[inset_0_0_0_1px_var(--color-gold)]" : "border-line hover:border-ivory/30")}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone">{kicker}</span>
            <span className="font-semibold">{label}</span>
            <span className="text-xs text-sand tabular-nums">{sub}</span>
          </button>
        ))}
      </div>
      <div id="pricing-measures" role="tabpanel" hidden={tab !== "measures"}>
        <MeasuresPricing productId={productId} rows={measures} />
      </div>
      <div id="pricing-surMesure" role="tabpanel" hidden={tab !== "surMesure"}>
        <SurMesurePricing productId={productId} config={surMesure} measures={measures} />
      </div>
    </div>
  );
}

function useMutate() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    try {
      await fn();
      if (success) toast.show(success, "success");
      router.refresh();
      return true;
    } catch (e) {
      toast.show(errMsg(e), "error");
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

function Block({ title, description, children, actions }: { title: string; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-panel border border-line bg-ink/60">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-sand">{title}</h3>
          {description && <p className="mt-1 max-w-2xl text-xs text-stone">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatusToggle({ active, onToggle, disabled }: { active: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onToggle}
      disabled={disabled}
      className={cn("inline-flex h-7 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition disabled:opacity-50", active ? "border-sage/50 bg-sage/10 text-ivory" : "border-line-strong text-stone")}
    >
      <span className={cn("size-2 rounded-full", active ? "bg-sage" : "bg-stone/50")} aria-hidden />
      {active ? "Active" : "Inactive"}
    </button>
  );
}

/** Price cell edited in place; saved on Enter / blur. */
function PriceCell({ value, onSave, label }: { value: number; onSave: (price: number) => Promise<boolean>; label: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const commit = async () => {
    if (draft == null) return;
    const n = Number(draft);
    if (!Number.isInteger(n) || n <= 0 || n === value) return setDraft(null);
    if (await onSave(n)) setDraft(null);
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="number"
        min={1}
        inputMode="numeric"
        aria-label={label}
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(null);
        }}
        className={cn(inp, "h-9 w-28", draft != null && draft !== String(value) && "border-gold")}
      />
      <span className="text-xs text-stone">DA</span>
    </span>
  );
}

// ───────────────────────── A. Standard 10 cm table


// ───────────────────────── A. Measures created by the admin

type Draft = { w: string; h: string; price: string; label: string; description: string; isActive: boolean };
const emptyDraft: Draft = { w: "", h: "", price: "", label: "", description: "", isActive: true };
const draftPayload = (d: Draft) => ({ widthCm: toInt(d.w), heightCm: toInt(d.h), price: toInt(d.price), label: d.label, description: d.description, isActive: d.isActive });
const draftValid = (d: Draft) => Number.isInteger(Number(d.w)) && Number(d.w) > 0 && Number.isInteger(Number(d.h)) && Number(d.h) > 0 && Number.isInteger(Number(d.price)) && Number(d.price) > 0;

function MeasureForm({ value, onChange }: { value: Draft; onChange: (d: Draft) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,8rem))_1fr]">
      <label className="flex flex-col gap-1 text-xs font-semibold text-sand">Longueur (cm)<input type="number" min={1} value={value.w} onChange={(e) => onChange({ ...value, w: e.target.value })} className={cn(inp, "w-full")} /></label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-sand">Hauteur (cm)<input type="number" min={1} value={value.h} onChange={(e) => onChange({ ...value, h: e.target.value })} className={cn(inp, "w-full")} /></label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-sand">Prix (DA)<input type="number" min={1} value={value.price} onChange={(e) => onChange({ ...value, price: e.target.value })} className={cn(inp, "w-full")} /></label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-sand">Label (facultatif)<input maxLength={80} value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} placeholder="ex. Grand format" className={cn(inp, "w-full")} /></label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-sand sm:col-span-4">Description (facultatif)<textarea rows={2} maxLength={500} value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} className={cn(fieldClasses, "py-2 text-sm font-normal")} /></label>
      <label className="flex items-center gap-2 text-xs font-semibold text-sand"><input type="checkbox" checked={value.isActive} onChange={(e) => onChange({ ...value, isActive: e.target.checked })} className="size-4 accent-[var(--color-gold)]" /> Active</label>
    </div>
  );
}

function MeasuresPricing({ productId, rows }: { productId: string; rows: MeasureRow[] }) {
  const confirm = useConfirm();
  const { busy, run } = useMutate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<{ id: string; d: Draft } | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const base = `/api/admin/products/${productId}/pricing/measures`;

  const shown = rows.filter((r) => {
    if (status === "active" && !r.isActive) return false;
    if (status === "inactive" && r.isActive) return false;
    const needle = q.trim().toLowerCase().replace(/\s/g, "").replace("×", "x");
    return !needle || `${r.widthCm}x${r.heightCm}`.includes(needle) || String(r.price).includes(needle) || (r.label ?? "").toLowerCase().includes(needle);
  });
  const existing = draftValid(draft) ? rows.find((r) => r.widthCm === Number(draft.w) && r.heightCm === Number(draft.h)) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Block
        title="Mesures proposées"
        description="Les mesures que vous créez, n'importe quelle dimension, chacune avec son prix exact. Elles sont proposées au client et toujours prioritaires : si le client choisit (ou saisit) l'une d'elles, c'est ce prix qui s'applique."
      >
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <label className="relative min-w-48 flex-1">
            <span className="sr-only">Rechercher</span>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-stone" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher : 70x100, 5500, label…" className={cn(inp, "w-full ps-9")} />
          </label>
          <select aria-label="Filtrer par statut" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={cn(inp, "w-36")}>
            <option value="all">Tous statuts</option>
            <option value="active">Actives</option>
            <option value="inactive">Inactives</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-field border border-dashed border-line-strong p-6 text-center text-sm text-sand">Aucune mesure. Créez-en une ci-dessous ou utilisez le générateur.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((r) =>
              editing?.id === r.id ? (
                <li key={r.id} className="flex flex-col gap-3 rounded-field border border-gold/50 bg-gold/5 p-4">
                  <MeasureForm value={editing.d} onChange={(d) => setEditing({ id: r.id, d })} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!draftValid(editing.d)} loading={busy === r.id} onClick={async () => { if (await run(r.id, () => api(`${base}/${r.id}`, { method: "PATCH", json: draftPayload(editing.d) }), "Mesure enregistrée.")) setEditing(null); }}>Enregistrer</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
                  </div>
                </li>
              ) : (
                <li key={r.id} className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 rounded-field border border-line px-4 py-3 text-sm", !r.isActive && "opacity-60")}>
                  <span className="w-28 font-semibold tabular-nums">{r.widthCm} × {r.heightCm} cm</span>
                  <PriceCell key={r.updatedAt} value={r.price} label={`Prix ${r.widthCm} × ${r.heightCm}`} onSave={(price) => run(r.id, () => api(`${base}/${r.id}`, { method: "PATCH", json: { price } }), `Prix ${r.widthCm} × ${r.heightCm} enregistré.`)} />
                  <span className="min-w-32 flex-1">
                    {r.label ? <span className="font-semibold">{r.label}</span> : <span className="text-stone">Sans label</span>}
                    {r.description && <span className="block text-xs text-stone">{r.description}</span>}
                  </span>
                  <StatusToggle active={r.isActive} disabled={busy === r.id} onToggle={() => run(r.id, () => api(`${base}/${r.id}`, { method: "PATCH", json: { isActive: !r.isActive } }))} />
                  <span className="flex gap-1">
                    <button type="button" aria-label={`Modifier ${r.widthCm} × ${r.heightCm}`} onClick={() => setEditing({ id: r.id, d: { w: String(r.widthCm), h: String(r.heightCm), price: String(r.price), label: r.label ?? "", description: r.description ?? "", isActive: r.isActive } })} className="grid size-8 place-items-center rounded-full text-sand hover:bg-ivory/8 hover:text-ivory">
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Supprimer ${r.widthCm} × ${r.heightCm}`}
                      onClick={async () => {
                        const ok = await confirm({ title: `Supprimer ${r.widthCm} × ${r.heightCm} cm ?`, message: "Cette mesure ne sera plus proposée (le Sur Mesure s'appliquera s'il est actif). Les commandes passées gardent leur prix.", confirmLabel: "Supprimer", danger: true });
                        if (ok) await run(r.id, () => api(`${base}/${r.id}`, { method: "DELETE" }), "Mesure supprimée.");
                      }}
                      className="grid size-8 place-items-center rounded-full text-sand hover:bg-ember/10 hover:text-ember"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </span>
                </li>
              ),
            )}
            {shown.length === 0 && <li className="text-center text-sm text-sand">Aucun résultat.</li>}
          </ul>
        )}

        <div className="mt-5 flex flex-col gap-3 rounded-field border border-line bg-umber-900/50 p-4">
          <span className="text-[13px] font-semibold text-sand">Nouvelle mesure</span>
          <MeasureForm value={draft} onChange={setDraft} />
          {existing && <p className="text-xs text-gold">{existing.widthCm} × {existing.heightCm} existe déjà ({p(existing.price)}) — elle sera mise à jour.</p>}
          <div>
            <Button size="sm" disabled={!draftValid(draft)} loading={busy === "new"} onClick={async () => { if (await run("new", () => api(base, { method: "POST", json: { rows: [draftPayload(draft)] } }), existing ? "Mesure mise à jour." : "Mesure créée.")) setDraft(emptyDraft); }}>
              <Plus className="size-3.5" /> {existing ? "Mettre à jour" : "Créer la mesure"}
            </Button>
          </div>
        </div>
      </Block>

      <Block
        title="Générateur de grille"
        description="Crée d'un coup plusieurs mesures par pas de 10 cm entre deux bornes. Saisissez le prix de chaque case : seules les cases remplies sont enregistrées."
        actions={<Button size="sm" variant="outline" onClick={() => setGenOpen((o) => !o)} aria-expanded={genOpen}><Grid3x3 className="size-3.5" /> {genOpen ? "Masquer" : "Ouvrir"}</Button>}
      >
        {genOpen ? <Generator productId={productId} rows={rows} /> : <p className="text-sm text-sand">Pratique pour créer de nombreuses mesures d&apos;un coup.</p>}
      </Block>
    </div>
  );
}

function Generator({ productId, rows }: { productId: string; rows: MeasureRow[] }) {
  const { busy, run } = useMutate();
  const [bounds, setBounds] = useState({ wFrom: "40", wTo: "100", hFrom: "40", hTo: "120" });
  const [grid, setGrid] = useState<{ widths: number[]; heights: number[] } | null>(null);
  const [cells, setCells] = useState<Record<string, string>>({});
  const [fill, setFill] = useState("");
  const key = (w: number, h: number) => `${w}x${h}`;
  const existing = useMemo(() => new Map(rows.map((r) => [key(r.widthCm, r.heightCm), r])), [rows]);

  const build = () => {
    const widths = range(Number(bounds.wFrom), Number(bounds.wTo));
    const heights = range(Number(bounds.hFrom), Number(bounds.hTo));
    if (!widths.length || !heights.length || widths.length * heights.length > 400) return;
    // Existing prices are shown so they can be reviewed; untouched cells are not re-sent.
    setGrid({ widths, heights });
    setCells({});
  };
  const changed = Object.entries(cells).filter(([k, v]) => v.trim() !== "" && Number(v) > 0 && Number(v) !== existing.get(k)?.price);
  const invalid = Object.values(cells).some((v) => v.trim() !== "" && !(Number.isInteger(Number(v)) && Number(v) > 0));
  const tooMany = range(Number(bounds.wFrom), Number(bounds.wTo)).length * range(Number(bounds.hFrom), Number(bounds.hTo)).length > 400;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        {(
          [
            ["wFrom", "Longueur de"],
            ["wTo", "à"],
            ["hFrom", "Hauteur de"],
            ["hTo", "à"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex flex-col gap-1 text-xs font-semibold text-sand">
            {label} (cm)
            <input type="number" min={STEP} step={STEP} value={bounds[k]} onChange={(e) => setBounds({ ...bounds, [k]: e.target.value })} className={cn(inp, "w-24")} />
          </label>
        ))}
        <Button size="sm" variant="outline" onClick={build} disabled={tooMany}>
          Générer la grille
        </Button>
      </div>
      {tooMany && <p className="text-xs text-ember">400 combinaisons maximum à la fois — réduisez l&apos;intervalle.</p>}

      {grid && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-sand">
            <span>Remplir les cases vides avec</span>
            <input type="number" min={1} value={fill} onChange={(e) => setFill(e.target.value)} placeholder="Prix (DA)" aria-label="Prix pour les cases vides" className={cn(inp, "h-8 w-28")} />
            <Button
              size="sm"
              variant="ghost"
              disabled={!Number(fill)}
              onClick={() =>
                setCells((c) => {
                  const next = { ...c };
                  for (const w of grid.widths) for (const h of grid.heights) if (!existing.has(key(w, h)) && !next[key(w, h)]) next[key(w, h)] = fill;
                  return next;
                })
              }
            >
              Appliquer
            </Button>
            <span className="text-stone">(puis ajustez chaque case — rien n&apos;est calculé)</span>
          </div>
          <div className="max-w-full overflow-auto rounded-field border border-line">
            <table className="text-sm [&_td]:border-t [&_td]:border-s [&_td]:border-line [&_td]:p-1 [&_th]:bg-umber-900 [&_th]:px-2 [&_th]:py-2 [&_th]:text-[11px] [&_th]:font-bold [&_th]:text-stone">
              <thead>
                <tr>
                  <th className="sticky start-0 z-10">L \ H</th>
                  {grid.heights.map((h) => <th key={h} className="tabular-nums">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {grid.widths.map((w) => (
                  <tr key={w}>
                    <th className="sticky start-0 z-10 tabular-nums">{w}</th>
                    {grid.heights.map((h) => {
                      const k = key(w, h);
                      const ex = existing.get(k);
                      const value = cells[k] ?? (ex ? String(ex.price) : "");
                      return (
                        <td key={h}>
                          <input
                            type="number"
                            min={1}
                            inputMode="numeric"
                            aria-label={`Grille : prix ${w} × ${h} cm`}
                            value={value}
                            onChange={(e) => setCells((c) => ({ ...c, [k]: e.target.value }))}
                            className={cn(
                              "h-8 w-[5.5rem] rounded-md border bg-umber-900 px-2 text-xs tabular-nums",
                              ex && cells[k] == null ? "border-sage/40 text-sand" : cells[k] ? "border-gold" : "border-line",
                            )}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              disabled={!changed.length || invalid}
              loading={busy === "gen"}
              onClick={async () => {
                const payload = changed.map(([k, v]) => {
                  const [w, h] = k.split("x").map(Number);
                  return { widthCm: w, heightCm: h, price: Number(v), isActive: existing.get(k)?.isActive ?? true };
                });
                if (await run("gen", () => api(`/api/admin/products/${productId}/pricing/measures`, { method: "POST", json: { rows: payload } }), `${payload.length} prix enregistré(s).`)) setCells({});
              }}
            >
              Enregistrer {changed.length || ""} prix
            </Button>
            <span className="text-xs text-stone">Vert : déjà enregistré · Doré : nouveau ou modifié · Vide : non proposé.</span>
            {invalid && <span className="text-xs text-ember">Prix entiers supérieurs à 0 uniquement.</span>}
          </div>
        </>
      )}
    </div>
  );
}

// ───────────────────────── B. Special / Sur Mesure


// ───────────────────────── B. Sur Mesure (stable price ± per 10 cm)

type SmForm = Record<"refWidthCm" | "refHeightCm" | "refPrice" | "widthStepPrice" | "heightStepPrice" | "minWidthCm" | "maxWidthCm" | "minHeightCm" | "maxHeightCm" | "minPrice", string>;
const str = (n: number | null | undefined) => (n == null ? "" : String(n));

function SurMesurePricing({ productId, config, measures }: { productId: string; config: SurMesureConfig; measures: MeasureRow[] }) {
  const { busy, run } = useMutate();
  const [enabled, setEnabled] = useState(config.enabled);
  const [f, setF] = useState<SmForm>({
    refWidthCm: str(config.refWidthCm),
    refHeightCm: str(config.refHeightCm),
    refPrice: str(config.refPrice),
    widthStepPrice: str(config.widthStepPrice ?? (config.refPrice == null ? 200 : null)),
    heightStepPrice: str(config.heightStepPrice ?? (config.refPrice == null ? 200 : null)),
    minWidthCm: str(config.minWidthCm),
    maxWidthCm: str(config.maxWidthCm),
    minHeightCm: str(config.minHeightCm),
    maxHeightCm: str(config.maxHeightCm),
    minPrice: str(config.minPrice),
  });
  const [sim, setSim] = useState({ w: "", h: "" });
  const set = (k: keyof SmForm) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const draft: SurMesureConfig = {
    enabled,
    refWidthCm: num(f.refWidthCm),
    refHeightCm: num(f.refHeightCm),
    refPrice: num(f.refPrice),
    widthStepPrice: num(f.widthStepPrice),
    heightStepPrice: num(f.heightStepPrice),
    minWidthCm: num(f.minWidthCm),
    maxWidthCm: num(f.maxWidthCm),
    minHeightCm: num(f.minHeightCm),
    maxHeightCm: num(f.maxHeightCm),
    minPrice: num(f.minPrice),
  };
  const complete = isSurMesureConfigured({ ...draft, enabled: true });
  const simW = Number(sim.w || draft.refWidthCm || 0);
  const simH = Number(sim.h || draft.refHeightCm || 0);
  const preset = findMeasure(measures, simW, simH);
  const calc = complete ? calculateSurMesurePrice({ ...draft, enabled: true }, simW, simH) : null;
  const field = (k: keyof SmForm, label: string, help?: string) => (
    <label className="flex flex-col gap-1 text-xs font-semibold text-sand">
      {label}
      <input type="number" min={0} value={f[k]} onChange={set(k)} className={cn(inp, "w-full")} />
      {help && <span className="font-normal text-stone">{help}</span>}
    </label>
  );

  return (
    <Block
      title="Sur Mesure (prix calculé)"
      description={`Pour toute mesure qui n'est pas dans « Mesures proposées » : le prix part du prix stable de la mesure de référence, puis augmente ou diminue d'un montant fixe pour chaque ${STEP} cm de longueur et chaque ${STEP} cm de hauteur.`}
    >
      <div className="flex flex-col gap-6">
        <label className="flex items-start gap-3 rounded-field border border-line p-4 text-sm font-semibold">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-gold)]" />
          <span>
            Activer le Sur Mesure pour ce produit
            <span className="block text-xs font-normal text-stone">Le client peut alors choisir n&apos;importe quelle mesure sur la fiche produit, avec le prix calculé ci-dessous.</span>
          </span>
        </label>

        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="mb-2 text-[13px] font-semibold text-sand">Prix stable</legend>
          {field("refWidthCm", "Longueur de référence (cm)")}
          {field("refHeightCm", "Hauteur de référence (cm)")}
          {field("refPrice", "Prix de référence (DA)")}
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-[13px] font-semibold text-sand">Variation par {STEP} cm</legend>
          {field("widthStepPrice", `Longueur : ± DA par ${STEP} cm`, `+${STEP} cm → + ce montant · −${STEP} cm → − ce montant`)}
          {field("heightStepPrice", `Hauteur : ± DA par ${STEP} cm`, `+${STEP} cm → + ce montant · −${STEP} cm → − ce montant`)}
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-5">
          <legend className="mb-2 text-[13px] font-semibold text-sand">Limites (facultatif)</legend>
          {field("minWidthCm", "Longueur min.")}
          {field("maxWidthCm", "Longueur max.")}
          {field("minHeightCm", "Hauteur min.")}
          {field("maxHeightCm", "Hauteur max.")}
          {field("minPrice", "Prix minimum")}
        </fieldset>
        <p className="text-xs text-stone">
          Chaque tranche de {STEP} cm commencée au-dessus de la référence compte (ex. +5 cm = 1 tranche) ; en dessous, seules les tranches complètes sont retirées. Hors limites, le client voit « nous contacter ».
        </p>

        <div className="flex flex-col gap-3 rounded-field border border-gold/40 bg-gold/5 p-4">
          <span className="flex items-center gap-2 text-[13px] font-semibold"><Calculator className="size-4 text-gold" /> Simulateur</span>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-sand">Longueur<input type="number" min={1} value={sim.w} placeholder={f.refWidthCm} onChange={(e) => setSim({ ...sim, w: e.target.value })} className={cn(inp, "w-28")} /></label>
            <span className="pb-2 text-stone">×</span>
            <label className="flex flex-col gap-1 text-xs font-semibold text-sand">Hauteur<input type="number" min={1} value={sim.h} placeholder={f.refHeightCm} onChange={(e) => setSim({ ...sim, h: e.target.value })} className={cn(inp, "w-28")} /></label>
          </div>
          {preset ? (
            <p className="text-sm">Mesure proposée {preset.widthCm} × {preset.heightCm} : <strong>{p(preset.price)}</strong> <span className="text-xs text-stone">(prioritaire sur le calcul)</span></p>
          ) : calc ? (
            <dl className="grid max-w-md grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm tabular-nums">
              <dt className="text-sand">Prix stable ({calc.detail.refWidthCm} × {calc.detail.refHeightCm})</dt><dd>{p(calc.detail.refPrice)}</dd>
              <dt className="text-sand">Longueur ({calc.detail.widthSteps > 0 ? "+" : ""}{calc.detail.widthSteps} × {STEP} cm)</dt><dd>{signed(calc.detail.widthAdjustment)}</dd>
              <dt className="text-sand">Hauteur ({calc.detail.heightSteps > 0 ? "+" : ""}{calc.detail.heightSteps} × {STEP} cm)</dt><dd>{signed(calc.detail.heightAdjustment)}</dd>
              {calc.detail.floored && (<><dt className="text-sand">Prix minimum appliqué</dt><dd /></>)}
              <dt className="border-t border-line pt-1 font-semibold">Prix Sur Mesure</dt><dd className="border-t border-line pt-1 font-semibold">{p(calc.price)}</dd>
            </dl>
          ) : (
            <p className="text-sm text-stone">{complete ? "Hors limites ou prix ≤ 0 : le client verra « nous contacter »." : "Renseignez la mesure de référence, le prix de référence et les prix par 10 cm."}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            disabled={enabled && !complete}
            loading={busy === "sm"}
            onClick={() => run("sm", () => api(`/api/admin/products/${productId}/pricing/sur-mesure`, { method: "PUT", json: draft }), enabled ? "Sur Mesure enregistré et actif." : "Paramètres enregistrés (Sur Mesure inactif).")}
          >
            <Ruler className="size-3.5" /> Enregistrer
          </Button>
          {enabled && !complete && <span className="text-xs text-ember">Paramètres incomplets.</span>}
          {!enabled && <Badge tone="outline">Inactif</Badge>}
        </div>
      </div>
    </Block>
  );
}
