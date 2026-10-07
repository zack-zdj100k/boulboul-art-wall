"use client";

import { Check, MessageCircle, Minus, Plus, Ruler, ShoppingBag, ShoppingBasket, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/frontend/components/ui/badge";
import { Button, buttonClasses } from "@/frontend/components/ui/button";
import { fieldClasses } from "@/frontend/components/ui/field";
import { useI18n } from "@/shared/i18n/client";
import { formatDate, formatPrice } from "@/shared/i18n/config";
import { api, ApiError } from "@/frontend/lib/api-client";
import { cart } from "@/frontend/lib/cart";
import { describeExtra } from "@/shared/lib/options";
import type { LineQuote } from "@/shared/lib/pricing";
import { cn } from "@/shared/lib/utils";
import { CheckoutDialog, type CheckoutCustomer } from "./checkout-dialog";

type Size = { widthCm: number; heightCm: number };

export type ConfiguratorProduct = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  isDemo: boolean;
  hasPricing: boolean;
  /** Measures created by Boulboul — dimensions only, prices always come from the server. */
  measures: (Size & { label: string | null; description: string | null })[];
  /** Sur Mesure (any measure, priced from a reference ± per 10 cm) — null when not offered. */
  surMesure: { refWidthCm: number; refHeightCm: number; minWidthCm: number | null; maxWidthCm: number | null; minHeightCm: number | null; maxHeightCm: number | null } | null;
  frames: { id: string; name: string; swatch: string | null }[];
  defaultFrameId: string | null;
  extras: { id: string; name: string; price: number; colors: { name: string; hex: string }[]; notePrompt: string | null }[];
  colors: string[];
  promoActive: boolean;
  promoEndsAt: string | null;
};

/** Server quote for one line (see src/shared/lib/pricing.ts). */
export type Breakdown = LineQuote;

export type Configuration = {
  productId: string;
  widthCm: number;
  heightCm: number;
  frameId: string | null;
  extraIds: string[];
  extraChoices: { id: string; color: string | null; note: string | null }[];
  color: string | null;
  quantity: number;
};

type QuoteResponse = { available: true; quote: Breakdown } | { available: false; reason: string };

const STEP_CM = 10;

/** [ − ] value cm [ + ]: ±10 cm per click, and the value can also be typed freely. */
function DimensionStepper({ label, value, onChange, min, max }: { label: string; value: string; onChange: (v: string) => void; min: number; max: number }) {
  const { t } = useI18n();
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= min && n <= max;
  const id = `dim-${label}`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-semibold text-sand">{label} ({t("common.cm")})</label>
      <div className="flex h-14 items-center rounded-field border border-line-strong bg-umber-950/40 focus-within:border-gold">
        <button
          type="button"
          onClick={() => onChange(String(Math.max(min, (valid ? n : min) - STEP_CM)))}
          disabled={valid && n - STEP_CM < min}
          aria-label={t("product.decrease", { label })}
          className="grid size-14 shrink-0 place-items-center text-sand transition hover:text-ivory disabled:opacity-25"
        >
          <Minus className="size-4" />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!valid}
          className="h-full w-full min-w-0 bg-transparent text-center text-lg font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => onChange(String(Math.min(max, (valid ? n : min) + STEP_CM)))}
          disabled={valid && n + STEP_CM > max}
          aria-label={t("product.increase", { label })}
          className="grid size-14 shrink-0 place-items-center text-sand transition hover:text-ivory disabled:opacity-25"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Dimensions, options and live price. Every price shown comes from the server pricing engine
 * (/api/pricing/quote): exact Sur Mesure measure → standard 10 cm table → otherwise no price
 * and a "contact us" message. Nothing is computed or trusted on the client.
 */
export function ProductConfigurator({ product, customer, contactHref }: { product: ConfiguratorProduct; customer: CheckoutCustomer | null; contactHref: string }) {
  const { t, locale } = useI18n();
  const hasMeasures = product.measures.length > 0;
  const sm = product.surMesure;
  const [mode, setMode] = useState<"measures" | "custom">(hasMeasures ? "measures" : "custom");

  // Measures created by Boulboul.
  const [picked, setPicked] = useState<Size>(product.measures[0] ?? { widthCm: 0, heightCm: 0 });

  // Sur Mesure: starts at the reference measure, ±10 cm per click or typed freely.
  const [custom, setCustom] = useState({ w: sm ? String(sm.refWidthCm) : "", h: sm ? String(sm.refHeightCm) : "" });
  const limits = { minW: sm?.minWidthCm ?? 1, maxW: sm?.maxWidthCm ?? 1000, minH: sm?.minHeightCm ?? 1, maxH: sm?.maxHeightCm ?? 1000 };

  const [frameId, setFrameId] = useState<string | null>(product.defaultFrameId);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [extraColor, setExtraColor] = useState<Record<string, string>>({});
  const [extraNote, setExtraNote] = useState<Record<string, string>>({});
  const [color, setColor] = useState<string | null>(product.colors[0] ?? null);
  const [quantity, setQuantity] = useState(1);
  const [result, setResult] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const seq = useRef(0);

  const dims: Size = mode === "measures" ? picked : { widthCm: Number(custom.w), heightCm: Number(custom.h) };
  const dimsValid = [dims.widthCm, dims.heightCm].every((n) => Number.isInteger(n) && n > 0 && n <= 1000);

  const config: Configuration = useMemo(
    () => ({
      productId: product.id,
      widthCm: dims.widthCm,
      heightCm: dims.heightCm,
      frameId,
      extraIds,
      extraChoices: extraIds.map((id) => ({ id, color: extraColor[id] ?? null, note: extraNote[id]?.trim() || null })),
      color,
      quantity,
    }),
    [product.id, dims.widthCm, dims.heightCm, frameId, extraIds, extraColor, extraNote, color, quantity],
  );

  useEffect(() => {
    if (!dimsValid || !product.hasPricing) return;
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api<QuoteResponse>("/api/pricing/quote", { method: "POST", json: config });
        if (id === seq.current) {
          setResult(res);
          setError(null);
        }
      } catch (e) {
        if (id === seq.current) {
          setResult(null);
          setError(t(e instanceof ApiError ? e.code : "errors.generic"));
        }
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [config, dimsValid, product.hasPricing, t]);

  const quote = dimsValid && result?.available ? result.quote : null;
  const needsSurMesure = dimsValid && result?.available === false;
  const shownError = !dimsValid && mode === "custom" && (custom.w || custom.h) ? t("validation.number") : error;

  const toggleExtra = (id: string) => {
    setExtraIds((x) => (x.includes(id) ? x.filter((e) => e !== id) : [...x, id]));
    const firstColor = product.extras.find((e) => e.id === id)?.colors[0];
    if (firstColor) setExtraColor((c) => ({ [id]: c[id] ?? firstColor.name, ...c }));
  };

  if (!product.hasPricing) {
    return (
      <div className="flex flex-col gap-4 rounded-panel border border-line bg-umber-900/50 p-6">
        <p className="text-2xl font-semibold">{t("product.priceOnRequest")}</p>
        <p className="text-sm leading-relaxed text-sand">{t("product.noPricing")}</p>
        <a href={contactHref} target={contactHref.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={buttonClasses("gold", "lg", "self-start")}>
          <MessageCircle className="size-4" aria-hidden /> {t("product.contactUs")}
        </a>
      </div>
    );
  }

  const legend = "mb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-sand";

  return (
    <div className="flex flex-col gap-8">
      {/* Dimensions */}
      <fieldset className="flex flex-col gap-4">
        <legend className={legend}>{t("product.dimensions")}</legend>
        {hasMeasures && sm && (
          <div role="tablist" aria-label={t("product.dimensions")} className="grid grid-cols-2 gap-1 rounded-full border border-line-strong p-1">
            {(["measures", "custom"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn("flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition", mode === m ? "bg-ivory text-paper" : "text-sand hover:text-ivory")}
              >
                {m === "custom" && <Ruler className="size-3.5" aria-hidden />}
                {m === "measures" ? t("product.standardMode") : t("product.surMesureMode")}
              </button>
            ))}
          </div>
        )}

        {mode === "measures" ? (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("product.standardMode")}>
            {product.measures.map((s) => {
              const selected = picked.widthCm === s.widthCm && picked.heightCm === s.heightCm;
              return (
                <button
                  key={`${s.widthCm}x${s.heightCm}`}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  title={s.description ?? undefined}
                  onClick={() => setPicked({ widthCm: s.widthCm, heightCm: s.heightCm })}
                  className={cn(
                    "flex flex-col items-start rounded-field border px-4 py-3 text-start text-sm font-semibold tabular-nums transition",
                    selected ? "border-gold bg-gold/10 text-ivory shadow-[inset_0_0_0_1px_var(--color-gold)]" : "border-line-strong text-sand hover:border-ivory/50",
                  )}
                >
                  {s.widthCm} × {s.heightCm} {t("common.cm")}
                  {s.label && <span className="text-xs font-normal text-stone">{s.label}</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-stone">{t("product.surMesureIntro")}</p>
            <div className="grid grid-cols-2 gap-3">
              <DimensionStepper label={t("product.width")} value={custom.w} min={limits.minW} max={limits.maxW} onChange={(w) => setCustom((c) => ({ ...c, w }))} />
              <DimensionStepper label={t("product.height")} value={custom.h} min={limits.minH} max={limits.maxH} onChange={(h) => setCustom((c) => ({ ...c, h }))} />
            </div>
            {sm && <p className="text-xs text-stone">{t("product.surMesureRef", { w: sm.refWidthCm, h: sm.refHeightCm })}</p>}
          </div>
        )}

        {!sm && (
          <p className="text-xs text-stone">
            {t("product.otherMeasure")}{" "}
            <a href={contactHref} target={contactHref.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="font-semibold text-gold hover:underline">
              {t("product.contactUs")}
            </a>
          </p>
        )}

        <div className="flex items-center justify-between rounded-field bg-umber-900/60 px-4 py-3 text-sm">
          <span className="text-sand">{t("product.selectedDimension")}</span>
          <span className="font-semibold tabular-nums">
            {dims.widthCm || "–"} × {dims.heightCm || "–"} {t("common.cm")}
          </span>
        </div>
      </fieldset>

      {/* Price */}
      <div className="flex flex-col gap-3 border-y border-line py-6" aria-live="polite" aria-busy={loading}>
        {needsSurMesure ? (
          <div className="flex flex-col gap-4 rounded-field border border-gold/40 bg-gold/5 p-5">
            <p className="text-sm leading-relaxed">{t("product.needsSurMesure")}</p>
            <a
              href={contactHref}
              target={contactHref.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className={buttonClasses("outline", "sm", "self-start")}
            >
              <MessageCircle className="size-4" aria-hidden /> {t("product.contactUs")}
            </a>
          </div>
        ) : quote ? (
          <div className={cn("flex flex-col gap-2 transition-opacity", loading && "opacity-50")}>
            {quote.pricingType === "PRESET" && quote.pricingLabel && (
              <Badge tone="outline" className="self-start">{quote.pricingLabel}</Badge>
            )}
            {quote.surMesure && (
              <dl className="mb-1 flex flex-col gap-1 rounded-field bg-umber-900/60 p-3 text-xs">
                <div className="flex justify-between"><dt className="text-sand">{t("product.refPrice", { w: quote.surMesure.refWidthCm, h: quote.surMesure.refHeightCm })}</dt><dd className="tabular-nums">{formatPrice(quote.surMesure.refPrice, locale)}</dd></div>
                {quote.surMesure.widthSteps !== 0 && (
                  <div className="flex justify-between"><dt className="text-sand">{t("product.width")} {quote.surMesure.widthSteps > 0 ? "+" : "−"}{Math.abs(quote.surMesure.widthSteps) * 10} {t("common.cm")}</dt><dd className="tabular-nums">{quote.surMesure.widthAdjustment >= 0 ? "+" : "−"} {formatPrice(Math.abs(quote.surMesure.widthAdjustment), locale)}</dd></div>
                )}
                {quote.surMesure.heightSteps !== 0 && (
                  <div className="flex justify-between"><dt className="text-sand">{t("product.height")} {quote.surMesure.heightSteps > 0 ? "+" : "−"}{Math.abs(quote.surMesure.heightSteps) * 10} {t("common.cm")}</dt><dd className="tabular-nums">{quote.surMesure.heightAdjustment >= 0 ? "+" : "−"} {formatPrice(Math.abs(quote.surMesure.heightAdjustment), locale)}</dd></div>
                )}
              </dl>
            )}
            {quote.promotionDiscount > 0 ? (
              <dl className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-sand">{t("product.originalPrice")}</dt><dd className="tabular-nums text-stone line-through">{formatPrice(quote.officialPrice, locale)}</dd></div>
                <div className="flex justify-between text-gold">
                  <dt>{t("product.promotion")}{quote.promotion?.type === "PERCENT" ? ` (−${quote.promotion.value} %)` : ""}</dt>
                  <dd className="tabular-nums">− {formatPrice(quote.promotionDiscount, locale)}</dd>
                </div>
                <div className="flex justify-between font-semibold"><dt>{t("product.promoPrice")}</dt><dd className="tabular-nums">{formatPrice(quote.priceAfterPromotion, locale)}</dd></div>
              </dl>
            ) : (
              <div className="flex justify-between text-sm"><span className="text-sand">{t("product.price")}</span><span className="font-semibold tabular-nums">{formatPrice(quote.officialPrice, locale)}</span></div>
            )}
            {quote.optionsPrice > 0 && (
              <div className="flex justify-between text-sm"><span className="text-sand">{t("product.optionsPrice")}</span><span className="tabular-nums">+ {formatPrice(quote.optionsPrice, locale)}</span></div>
            )}
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <span className="text-sm text-sand">{quote.quantity > 1 ? `${t("product.total")} (×${quote.quantity})` : t("product.total")}</span>
              <span className={cn("text-4xl font-semibold tabular-nums", quote.promotionDiscount > 0 && "text-gold")}>{formatPrice(quote.total, locale)}</span>
            </div>
          </div>
        ) : (
          <span className="text-4xl font-semibold text-stone">{loading ? "…" : "—"}</span>
        )}
        <p className="text-xs text-stone">{loading ? t("product.computing") : t("product.priceNote")}</p>
        {product.promoActive && product.promoEndsAt && <p className="text-xs font-semibold text-gold">{t("product.promoEnds", { date: formatDate(product.promoEndsAt, locale) })}</p>}
        {product.isDemo && (
          <p className="flex items-center gap-2 text-xs text-gold">
            <Badge tone="demo">{t("common.demo")}</Badge> {t("product.demoPrice")}
          </p>
        )}
      </div>

      {/* Frames — fixed add-on, never depends on the dimensions */}
      {product.frames.length > 0 && (
        <fieldset>
          <legend className={legend}>{t("product.frame")}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[{ id: null, name: t("product.noFrame"), swatch: null }, ...product.frames].map((f) => {
              const selected = frameId === f.id;
              return (
                <label
                  key={f.id ?? "none"}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-field border px-3 py-3 text-sm font-semibold transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold",
                    selected ? "border-gold bg-gold/10" : "border-line-strong text-sand hover:border-ivory/50",
                  )}
                >
                  <input type="radio" name="frame" className="sr-only" checked={selected} onChange={() => setFrameId(f.id)} />
                  <span
                    aria-hidden
                    className={cn("size-6 shrink-0 rounded-[4px] border-[3px]", f.swatch ? "border-transparent" : "border-dashed border-stone")}
                    style={f.swatch ? { borderColor: f.swatch, boxShadow: "inset 0 0 0 2px rgb(0 0 0 / .3)" } : undefined}
                  />
                  <span className="leading-tight">{f.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* Extras */}
      {product.extras.length > 0 && (
        <fieldset>
          <legend className={legend}>{t("product.extras")}</legend>
          <div className="flex flex-col gap-2">
            {product.extras.map((e) => {
              const checked = extraIds.includes(e.id);
              return (
                <div key={e.id} className={cn("rounded-field border transition", checked ? "border-gold bg-gold/10" : "border-line-strong hover:border-ivory/50")}>
                  <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold">
                    <span className="flex items-center gap-3">
                      <input type="checkbox" checked={checked} onChange={() => toggleExtra(e.id)} className="size-4 accent-[var(--color-gold)]" />
                      <span className="font-semibold">{e.name}</span>
                    </span>
                    <span className="text-stone tabular-nums">+ {formatPrice(e.price, locale)}</span>
                  </label>
                  {checked && (e.colors.length > 0 || e.notePrompt) && (
                    <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
                      {e.colors.length > 0 && (
                        <fieldset>
                          <legend className="mb-2 text-xs font-semibold text-sand">
                            {t("product.color")} : <span className="text-ivory">{extraColor[e.id]}</span>
                          </legend>
                          <div className="flex flex-wrap gap-2">
                            {e.colors.map((c) => (
                              <label key={c.name} title={c.name} className="cursor-pointer">
                                <input type="radio" name={`color-${e.id}`} className="peer sr-only" checked={extraColor[e.id] === c.name} onChange={() => setExtraColor((x) => ({ ...x, [e.id]: c.name }))} />
                                <span className="block size-8 rounded-full ring-1 ring-ivory/20 ring-offset-2 ring-offset-ink transition peer-checked:ring-2 peer-checked:ring-gold peer-focus-visible:ring-2 peer-focus-visible:ring-gold" style={{ background: c.hex }} />
                                <span className="sr-only">{c.name}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      )}
                      {e.notePrompt && (
                        <label className="flex flex-col gap-1.5 text-xs font-semibold text-sand">
                          {e.notePrompt}
                          <textarea
                            rows={2}
                            maxLength={300}
                            value={extraNote[e.id] ?? ""}
                            onChange={(ev) => setExtraNote((x) => ({ ...x, [e.id]: ev.target.value }))}
                            className={cn(fieldClasses, "min-h-16 py-2 text-sm font-normal")}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* Colours */}
      {product.colors.length > 0 && (
        <fieldset>
          <legend className={legend}>{t("product.color")}</legend>
          <div className="flex flex-wrap gap-2">
            {product.colors.map((c) => (
              <button key={c} type="button" aria-pressed={color === c} onClick={() => setColor(c)} className={cn("rounded-full border px-4 py-2 text-sm font-semibold", color === c ? "border-gold bg-gold/10" : "border-line-strong text-sand")}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/* Quantity + Buy now */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <span id="qty-label" className="text-[13px] font-bold uppercase tracking-[0.14em] text-sand">
            {t("product.quantity")}
          </span>
          <div className="flex h-14 items-center rounded-full border border-line-strong" role="group" aria-labelledby="qty-label">
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} className="grid size-14 place-items-center text-sand disabled:opacity-30" aria-label="−">
              <Minus className="size-4" />
            </button>
            <output className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
              {quantity}
            </output>
            <button type="button" onClick={() => setQuantity((q) => Math.min(50, q + 1))} className="grid size-14 place-items-center text-sand" aria-label="+">
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          {customer ? (
            <Button size="lg" variant="gold" className="flex-1" disabled={!quote || loading} onClick={() => setCheckoutOpen(true)}>
              <ShoppingBag className="size-4" aria-hidden />
              {t("product.buyNow")}
            </Button>
          ) : (
            <Link href={`/account/register?next=${encodeURIComponent(`/wall-art/${product.slug}`)}`} className={buttonClasses("gold", "lg", "flex-1")}>
              <UserPlus className="size-4" aria-hidden />
              {t("auth.createToOrder")}
            </Link>
          )}
          <Button
            size="lg"
            variant="outline"
            className="flex-1"
            disabled={!quote || loading}
            onClick={() => {
              if (!quote) return;
              cart.add({
                config,
                product: { name: product.name, image: product.image, slug: product.slug },
                summary: [`${quote.widthCm} × ${quote.heightCm} cm`, quote.frame?.name, ...quote.extras.map((x) => describeExtra(x))].filter(Boolean).join(" · "),
              });
              setAdded(true);
            }}
          >
            <ShoppingBasket className="size-4" aria-hidden />
            {t("cart.add")}
          </Button>
        </div>
      </div>
      {!customer && (
        <p className="-mt-4 text-xs text-stone">
          {t("auth.accountRequired")}{" "}
          <Link href={`/account/login?next=${encodeURIComponent(`/wall-art/${product.slug}`)}`} className="font-semibold text-gold hover:underline">
            {t("auth.alreadyAccount")}
          </Link>
        </p>
      )}
      {added && (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-field border border-sage/40 bg-sage/10 px-4 py-3 text-sm">
          <Check className="size-4 text-sage" aria-hidden /> {t("cart.added")}
          <Link href="/commande" className="font-semibold text-gold hover:underline">{t("cart.view")}</Link>
        </p>
      )}
      {shownError && (
        <p role="alert" className="text-sm font-medium text-ember">
          {shownError}
        </p>
      )}

      {quote && customer && (
        <CheckoutDialog
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          lines={[{ config, product: { name: product.name, image: product.image } }]}
          customer={customer}
        />
      )}
    </div>
  );
}
