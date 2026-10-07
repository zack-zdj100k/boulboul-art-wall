"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StepIndicator } from "@/components/ui/step-indicator";
import { useI18n } from "@/i18n/client";
import { formatPrice } from "@/i18n/config";
import { WILAYAS, getWilaya, wilayaLabel } from "@/lib/algeria";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { describeExtra } from "@/lib/options";
import type { SurMesureConfig } from "@/lib/pricing";
import { estimateCustom } from "@/lib/quote";
import { customOrderSchema } from "@/lib/validation";
import { CommuneSelect } from "@/components/ui/commune-select";

type Option = { id: string; name: string; description?: string | null; swatch?: string | null };
type FrameOpt = Option & { price: number };
type ExtraOpt = Option & { price: number; colors: { name: string; hex: string }[]; notePrompt: string | null };
type Upload = { id: string; token: string; name: string; size: number; preview: string };

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif";
const MAX_MB = 10;

export function CustomDesignForm({
  frames,
  extras,
  limits,
  prefill,
  surMesure,
}: {
  frames: FrameOpt[];
  extras: ExtraOpt[];
  limits: { minW: number; maxW: number; minH: number; maxH: number };
  prefill: { customerName: string; email: string; phone: string } | null;
  /** Stable reference price ± per 10 cm used for the live estimate (null = no estimate). */
  surMesure: SurMesureConfig | null;
}) {
  const { t, locale } = useI18n();
  const steps = [t("customize.steps.design"), t("customize.steps.dimensions"), t("customize.steps.frame"), t("customize.steps.description"), t("customize.steps.contact"), t("customize.steps.review")];
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState({
    widthCm: "",
    heightCm: "",
    frameId: "",
    extraIds: [] as string[],
    extraColor: {} as Record<string, string>,
    extraNote: {} as Record<string, string>,
    wantsOther: false,
    otherIdea: "",
    description: "",
    notes: "",
    customerName: prefill?.customerName ?? "",
    email: prefill?.email ?? "",
    phone: prefill?.phone ?? "",
    wilayaCode: "",
    commune: "",
    address: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const set = <K extends keyof typeof data>(k: K, v: (typeof data)[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const payload = () => ({
    designMediaId: upload?.id ?? null,
    designToken: upload?.token ?? null,
    description: data.description || undefined,
    widthCm: data.widthCm ? Number(data.widthCm) : null,
    heightCm: data.heightCm ? Number(data.heightCm) : null,
    frameId: data.frameId || null,
    extraIds: data.extraIds,
    extraChoices: data.extraIds.map((id) => ({ id, color: data.extraColor[id] ?? null, note: data.extraNote[id]?.trim() || null })),
    otherIdea: data.wantsOther && data.otherIdea ? data.otherIdea : undefined,
    notes: data.notes || undefined,
    customerName: data.customerName,
    email: data.email,
    phone: data.phone,
    wilayaCode: data.wilayaCode || undefined,
    commune: data.commune || undefined,
    address: data.address || undefined,
  });

  const uploadFile = (file: File) => {
    setUploadError(null);
    if (!ACCEPT.split(",").includes(file.type)) return setUploadError(t("errors.uploadType"));
    if (file.size > MAX_MB * 1024 * 1024) return setUploadError(t("errors.uploadSize"));
    const body = new FormData();
    body.append("file", file);
    // XHR for upload progress feedback.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads/design");
    xhr.upload.onprogress = (e) => e.lengthComputable && setUploading(Math.max(1, Math.round((e.loaded / e.total) * 100)));
    xhr.onload = () => {
      setUploading(0);
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 300) return setUploadError(t(res?.error?.code ?? "errors.generic"));
        if (upload) URL.revokeObjectURL(upload.preview);
        setUpload({ id: res.id, token: res.token, name: res.name, size: res.size, preview: URL.createObjectURL(file) });
      } catch {
        setUploadError(t("errors.generic"));
      }
    };
    xhr.onerror = () => {
      setUploading(0);
      setUploadError(t("errors.network"));
    };
    setUploading(1);
    xhr.send(body);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  // Per-step validation (subset of the shared server schema).
  const validateStep = (s: number) => {
    const next: Record<string, string> = {};
    if (s === 1) {
      for (const [k, min, max] of [["widthCm", limits.minW, limits.maxW], ["heightCm", limits.minH, limits.maxH]] as const) {
        const v = data[k];
        if (v && (!Number.isInteger(Number(v)) || Number(v) < min || Number(v) > max)) next[k] = "errors.invalidSize";
      }
    }
    if (s === 3 && !upload && !data.description.trim() && !(data.wantsOther && data.otherIdea.trim())) next.description = "validation.contactOrIdea";
    if (s === 4) {
      const parsed = customOrderSchema.safeParse(payload());
      if (!parsed.success) {
        for (const i of parsed.error.issues) {
          const key = String(i.path[0]);
          if (["customerName", "email", "phone", "wilayaCode", "commune", "address"].includes(key)) next[key] ??= i.message;
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const go = (delta: number) => {
    if (delta > 0 && !validateStep(step)) return;
    setDir(delta);
    setStep((s) => s + delta);
    requestAnimationFrame(() => document.getElementById("custom-form-top")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const submit = async () => {
    setSending(true);
    setSendError(null);
    try {
      const res = await api<{ reference: string }>("/api/custom-orders", { method: "POST", json: payload() });
      setDone(res.reference);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, "errors.generic");
      setSendError(t(err.code));
      if (Object.keys(err.fields).length) setErrors(err.fields);
    } finally {
      setSending(false);
    }
  };

  const err = (k: string) => (errors[k] ? t(errors[k]) : null);

  // Live indicative estimate: stable reference price ± per 10 cm + options (recomputed by the server).
  const optionPrices = [frames.find((f) => f.id === data.frameId)?.price ?? 0, ...extras.filter((x) => data.extraIds.includes(x.id)).map((x) => x.price)];
  const optionsTotal = optionPrices.reduce((s, x) => s + x, 0);
  const estimate = estimateCustom(surMesure, Number(data.widthCm) || null, Number(data.heightCm) || null, optionPrices);
  const frameName = frames.find((f) => f.id === data.frameId)?.name ?? t("customize.noFramePreference");
  const notProvided = <span className="text-stone">{t("customize.notProvided")}</span>;

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-6 py-10 text-center" role="status">
        <span className="grid size-16 place-items-center rounded-full bg-gold/15 text-gold shadow-glow">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <h2 className="font-display text-heading">{t("customize.successTitle")}</h2>
        <p className="max-w-md leading-relaxed text-sand">{t("customize.successText")}</p>
        <p className="rounded-full border border-line px-5 py-2 text-sm">
          {t("customize.reference")} : <strong className="tabular-nums">{done}</strong>
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink href="/wall-art">{t("home.finalCta")}</ButtonLink>
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t("customize.newRequest")}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-10" id="custom-form-top">
      <StepIndicator steps={steps} current={step} label={t("customize.title")} />

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={step}
          custom={dir}
          initial={{ opacity: 0, x: 32 * dir }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -32 * dir }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="min-h-[22rem]"
        >
          {step === 0 && (
            <section className="flex flex-col gap-5" aria-labelledby="s0">
              <h2 id="s0" className="font-display text-2xl">{t("customize.uploadTitle")}</h2>
              {upload ? (
                <div className="flex flex-col gap-4 rounded-panel border border-line bg-umber-900/60 p-4 sm:flex-row sm:items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img src={upload.preview} alt="" className="h-48 w-full rounded-art object-contain sm:size-40" />
                  <div className="flex flex-1 flex-col gap-2">
                    <p className="flex items-center gap-2 text-sm font-semibold text-sage">
                      <CheckCircle2 className="size-4" aria-hidden /> {t("customize.uploaded")}
                    </p>
                    <p className="break-all text-sm">{upload.name}</p>
                    <p className="text-xs text-stone tabular-nums">{(upload.size / 1024 / 1024).toFixed(2)} Mo</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                        <RefreshCw className="size-3.5" aria-hidden /> {t("customize.change")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          URL.revokeObjectURL(upload.preview);
                          setUpload(null);
                        }}
                      >
                        <Trash2 className="size-3.5" aria-hidden /> {t("common.remove")}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  disabled={uploading > 0}
                  className={cn(
                    "relative flex min-h-64 flex-col items-center justify-center gap-4 overflow-hidden rounded-panel border-2 border-dashed px-6 py-12 text-center transition",
                    dragging ? "border-gold bg-gold/8" : "border-line-strong bg-umber-900/50 hover:border-ivory/40",
                  )}
                >
                  <span className="grid size-14 place-items-center rounded-full bg-gold/12 text-gold">
                    <ImagePlus className="size-6" aria-hidden />
                  </span>
                  <span className="font-semibold">{uploading ? t("customize.uploading") : t("customize.uploadHint")}</span>
                  <span className="text-xs text-stone">{t("customize.uploadFormats", { max: MAX_MB })}</span>
                  {uploading > 0 && (
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-line" aria-hidden>
                      <span className="block h-full bg-gold transition-[width]" style={{ width: `${uploading}%` }} />
                    </span>
                  )}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                tabIndex={-1}
                aria-label={t("customize.uploadTitle")}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                  e.target.value = "";
                }}
              />
              {uploadError && (
                <p role="alert" className="text-sm font-medium text-ember">
                  ⚠ {uploadError}
                </p>
              )}
              {!upload && <p className="text-sm text-stone">{t("customize.noDesign")}</p>}
            </section>
          )}

          {step === 1 && (
            <section className="flex flex-col gap-6" aria-labelledby="s1">
              <div>
                <h2 id="s1" className="font-display text-2xl">{t("customize.dimensionsTitle")}</h2>
                <p className="mt-2 text-sm text-stone">{t("customize.dimensionsHint")}</p>
              </div>
              <div className="grid max-w-md grid-cols-2 gap-4">
                <Field label={`${t("product.width")} (${t("common.cm")})`} error={err("widthCm")} optional={t("common.optional")}>
                  {(p) => <Input {...p} type="number" inputMode="numeric" min={limits.minW} max={limits.maxW} step={10} placeholder={surMesure ? String(surMesure.refWidthCm) : "80"} value={data.widthCm} onChange={(e) => set("widthCm", e.target.value)} />}
                </Field>
                <Field label={`${t("product.height")} (${t("common.cm")})`} error={err("heightCm")} optional={t("common.optional")}>
                  {(p) => <Input {...p} type="number" inputMode="numeric" min={limits.minH} max={limits.maxH} step={10} placeholder={surMesure ? String(surMesure.refHeightCm) : "120"} value={data.heightCm} onChange={(e) => set("heightCm", e.target.value)} />}
                </Field>
              </div>
              <p className="text-xs text-stone">{t("product.sizeRange", { minW: limits.minW, minH: limits.minH, maxW: limits.maxW, maxH: limits.maxH })}</p>
            </section>
          )}

          {step === 2 && (
            <section className="flex flex-col gap-8" aria-labelledby="s2">
              <h2 id="s2" className="sr-only">{t("customize.steps.frame")}</h2>
              {frames.length > 0 && (
                <fieldset>
                  <legend className="mb-4 font-display text-2xl">{t("customize.frameTitle")}</legend>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {[{ id: "", name: t("customize.noFramePreference"), swatch: null }, ...frames].map((f) => (
                      <label key={f.id || "none"} className={cn("flex cursor-pointer items-center gap-3 rounded-field border px-4 py-4 text-sm font-semibold transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold", data.frameId === f.id ? "border-gold bg-gold/10" : "border-line-strong text-sand hover:border-ivory/50")}>
                        <input type="radio" name="frame" className="sr-only" checked={data.frameId === f.id} onChange={() => set("frameId", f.id)} />
                        <span aria-hidden className={cn("size-6 shrink-0 rounded-[4px] border-[3px]", f.swatch ? "" : "border-dashed border-stone")} style={f.swatch ? { borderColor: f.swatch } : undefined} />
                        {f.name}
                        {"price" in f && f.price > 0 && (
                          <span className="ms-auto text-xs font-normal text-stone tabular-nums">
                            + {formatPrice(f.price, locale)}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <fieldset>
                <legend className="font-display text-2xl">{t("customize.extrasTitle")}</legend>
                <p className="mt-2 mb-4 text-sm text-stone">{t("customize.extrasHint")}</p>
                <div className="flex flex-col gap-2">
                  {extras.map((x) => {
                    const checked = data.extraIds.includes(x.id);
                    return (
                      <div key={x.id} className={cn("rounded-field border transition", checked ? "border-gold bg-gold/10" : "border-line-strong hover:border-ivory/50")}>
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--color-gold)]"
                            checked={checked}
                            onChange={() => {
                              set("extraIds", checked ? data.extraIds.filter((i) => i !== x.id) : [...data.extraIds, x.id]);
                              if (!checked && x.colors[0] && !data.extraColor[x.id]) set("extraColor", { ...data.extraColor, [x.id]: x.colors[0].name });
                            }}
                          />
                          <span className="font-semibold">{x.name}</span>
                          {x.description && <span className="text-stone">— {x.description}</span>}
                          {x.price > 0 && <span className="ms-auto text-xs text-stone tabular-nums">+ {formatPrice(x.price, locale)}</span>}
                        </label>
                        {checked && (x.colors.length > 0 || x.notePrompt) && (
                          <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
                            {x.colors.length > 0 && (
                              <fieldset>
                                <legend className="mb-2 text-xs font-semibold text-sand">
                                  {t("product.color")} : <span className="text-ivory">{data.extraColor[x.id]}</span>
                                </legend>
                                <div className="flex flex-wrap gap-2">
                                  {x.colors.map((c) => (
                                    <label key={c.name} title={c.name} className="cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`color-${x.id}`}
                                        className="peer sr-only"
                                        checked={data.extraColor[x.id] === c.name}
                                        onChange={() => set("extraColor", { ...data.extraColor, [x.id]: c.name })}
                                      />
                                      <span className="block size-8 rounded-full ring-1 ring-ivory/20 ring-offset-2 ring-offset-ink transition peer-checked:ring-2 peer-checked:ring-gold peer-focus-visible:ring-2 peer-focus-visible:ring-gold" style={{ background: c.hex }} />
                                      <span className="sr-only">{c.name}</span>
                                    </label>
                                  ))}
                                </div>
                              </fieldset>
                            )}
                            {x.notePrompt && (
                              <label className="flex flex-col gap-1.5 text-xs font-semibold text-sand">
                                {x.notePrompt}
                                <Textarea rows={2} className="min-h-16 py-2 text-sm font-normal" maxLength={300} value={data.extraNote[x.id] ?? ""} onChange={(e) => set("extraNote", { ...data.extraNote, [x.id]: e.target.value })} />
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <label className={cn("flex cursor-pointer items-center gap-3 rounded-field border px-4 py-3 text-sm transition", data.wantsOther ? "border-gold bg-gold/10" : "border-line-strong hover:border-ivory/50")}>
                    <input type="checkbox" className="size-4 accent-[var(--color-gold)]" checked={data.wantsOther} onChange={(e) => set("wantsOther", e.target.checked)} />
                    <span className="font-semibold">{t("customize.otherIdea")}</span>
                  </label>
                  {data.wantsOther && (
                    <Textarea aria-label={t("customize.otherIdea")} rows={3} className="min-h-24" placeholder={t("customize.otherIdeaPlaceholder")} value={data.otherIdea} onChange={(e) => set("otherIdea", e.target.value)} maxLength={1000} />
                  )}
                </div>
              </fieldset>
            </section>
          )}

          {step === 3 && (
            <section className="flex flex-col gap-6" aria-labelledby="s3">
              <h2 id="s3" className="font-display text-2xl">{t("customize.descriptionTitle")}</h2>
              <Field label={t("customize.descriptionTitle")} error={err("description")}>
                {(p) => <Textarea {...p} rows={6} placeholder={t("customize.descriptionPlaceholder")} value={data.description} onChange={(e) => set("description", e.target.value)} maxLength={3000} />}
              </Field>
              <Field label={t("customize.notes")} optional={t("common.optional")}>
                {(p) => <Textarea {...p} rows={3} className="min-h-24" value={data.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} />}
              </Field>
            </section>
          )}

          {step === 4 && (
            <section className="flex flex-col gap-6" aria-labelledby="s4">
              <h2 id="s4" className="font-display text-2xl">{t("customize.contactTitle")}</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t("checkout.fullName")} error={err("customerName")} className="sm:col-span-2">
                  {(p) => <Input {...p} autoComplete="name" value={data.customerName} onChange={(e) => set("customerName", e.target.value)} />}
                </Field>
                <Field label={t("checkout.phone")} error={err("phone")}>
                  {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="05 xx xx xx xx" value={data.phone} onChange={(e) => set("phone", e.target.value)} />}
                </Field>
                <Field label={t("checkout.email")} error={err("email")}>
                  {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" dir="ltr" value={data.email} onChange={(e) => set("email", e.target.value)} />}
                </Field>
                <Field label={t("checkout.wilaya")} optional={t("common.optional")} error={err("wilayaCode")}>
                  {(p) => (
                    <Select
                      {...p}
                      value={data.wilayaCode}
                      onChange={(e) => {
                        set("wilayaCode", e.target.value);
                        set("commune", "");
                      }}
                    >
                      <option value="">{t("checkout.selectWilaya")}</option>
                      {WILAYAS.map((w) => (
                        <option key={w.code} value={w.code}>
                          {wilayaLabel(w, locale)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label={t("checkout.commune")} optional={t("common.optional")}>
                  {(p) => <CommuneSelect {...p} wilayaCode={data.wilayaCode} value={data.commune} onValueChange={(v) => set("commune", v)} />}
                </Field>
                <Field label={t("checkout.address")} optional={t("common.optional")} className="sm:col-span-2">
                  {(p) => <Input {...p} autoComplete="street-address" value={data.address} onChange={(e) => set("address", e.target.value)} />}
                </Field>
              </div>
            </section>
          )}

          {step === 5 && (
            <section className="flex flex-col gap-6" aria-labelledby="s5">
              <h2 id="s5" className="font-display text-2xl">{t("customize.reviewTitle")}</h2>
              <div className="grid gap-6 md:grid-cols-[200px_1fr]">
                <div className="relative aspect-square overflow-hidden rounded-art border border-line bg-umber-900">
                  {upload ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                    <img src={upload.preview} alt="" className="size-full object-contain" />
                  ) : (
                    <span className="grid size-full place-items-center p-4 text-center text-xs text-stone">{t("customize.noDesign")}</span>
                  )}
                </div>
                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
                  <dt className="text-stone">{t("product.dimensions")}</dt>
                  <dd className="tabular-nums">{data.widthCm && data.heightCm ? `${data.widthCm} × ${data.heightCm} cm` : notProvided}</dd>
                  <dt className="text-stone">{t("product.frame")}</dt>
                  <dd>{frameName}</dd>
                  <dt className="text-stone">{t("product.extras")}</dt>
                  <dd>
                    {[
                      ...extras
                        .filter((x) => data.extraIds.includes(x.id))
                        .map((x) => describeExtra({ id: x.id, name: x.name, color: x.colors.length ? data.extraColor[x.id] : null, note: x.notePrompt ? data.extraNote[x.id]?.trim() : null })),
                      ...(data.wantsOther && data.otherIdea ? [data.otherIdea] : []),
                    ].join(", ") || notProvided}
                  </dd>
                  <dt className="text-stone">{t("customize.steps.description")}</dt>
                  <dd className="whitespace-pre-line">{data.description || notProvided}</dd>
                  {data.notes && (
                    <>
                      <dt className="text-stone">{t("customize.notes")}</dt>
                      <dd className="whitespace-pre-line">{data.notes}</dd>
                    </>
                  )}
                  <dt className="text-stone">{t("customize.steps.contact")}</dt>
                  <dd>
                    {data.customerName} · <span dir="ltr">{data.phone}</span> · <span dir="ltr">{data.email}</span>
                    {(data.address || data.commune || data.wilayaCode) && (
                      <>
                        <br />
                        {[data.address, data.commune, getWilaya(data.wilayaCode) && wilayaLabel(getWilaya(data.wilayaCode)!, locale)].filter(Boolean).join(", ")}
                      </>
                    )}
                  </dd>
                </dl>
              </div>
              {sendError && (
                <p role="alert" className="text-sm font-medium text-ember">
                  ⚠ {sendError}
                </p>
              )}
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      {step >= 1 && (
        <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-line bg-umber-900/70 px-5 py-4">
          <div className="max-w-md">
            <p className="text-xs font-bold tracking-[0.14em] text-stone uppercase">{estimate ? t("customize.estimate") : t("customize.quoteTitle")}</p>
            <p className="text-xs text-stone">
              {estimate
                ? t("customize.estimateNote", { w: estimate.detail.refWidthCm, h: estimate.detail.refHeightCm })
                : surMesure
                  ? t("customize.estimateNeedsSize")
                  : t("customize.quoteNote")}
            </p>
          </div>
          {estimate ? (
            <motion.p key={estimate.total} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold tabular-nums">
              {formatPrice(estimate.total, locale)}
            </motion.p>
          ) : optionsTotal > 0 && (
            <motion.p key={optionsTotal} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-sand">
              {t("customize.optionsTotal")} <strong className="text-lg text-ivory tabular-nums">+ {formatPrice(optionsTotal, locale)}</strong>
            </motion.p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line pt-6">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => go(-1)} disabled={sending}>
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t("common.previous")}
          </Button>
        ) : (
          <span />
        )}
        {step < steps.length - 1 ? (
          <Button onClick={() => go(1)} disabled={uploading > 0}>
            {t("common.next")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Button>
        ) : (
          <Button variant="gold" size="lg" onClick={submit} loading={sending}>
            {sending ? t("customize.sending") : t("customize.send")}
          </Button>
        )}
      </div>
    </div>
  );
}
