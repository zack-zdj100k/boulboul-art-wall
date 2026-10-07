"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Home, Lock, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/frontend/components/ui/button";
import { Dialog } from "@/frontend/components/ui/dialog";
import { CommuneSelect } from "@/frontend/components/ui/commune-select";
import { Field, Input, Select, Textarea } from "@/frontend/components/ui/field";
import { StepIndicator } from "@/frontend/components/ui/step-indicator";
import { useToast } from "@/frontend/components/ui/toast";
import { useI18n } from "@/shared/i18n/client";
import { formatPrice } from "@/shared/i18n/config";
import { WILAYAS, getWilaya, wilayaLabel } from "@/shared/lib/algeria";
import { api, ApiError } from "@/frontend/lib/api-client";
import type { CartConfig } from "@/frontend/lib/cart";
import { describeExtra } from "@/shared/lib/options";
import { cn } from "@/shared/lib/utils";
import { REFERRAL_SOURCES, checkoutAccountSchema, customerSchema } from "@/shared/lib/validation";
import type { Breakdown } from "./product-configurator";

export type CheckoutCustomer = { customerName: string; email: string; phone: string };
export type CheckoutLine = { config: CartConfig; product: { name: string; image: string | null } };

type Form = { customerName: string; email: string; phone: string; wilayaCode: string; commune: string; address: string; notes: string; deliveryMethod: "HOME" | "STOP_DESK" };
type AccountForm = { age: string; password: string; confirmPassword: string; referralSource: string; referralOther: string };
type Stage = "info" | "account" | "review";
type Quote = {
  subtotal: number;
  delivery: { fee: number | null; free: boolean; home: number | null; stopDesk: number | null; method: "HOME" | "STOP_DESK" };
  total: number;
  items: { productName: string; quote: Breakdown }[];
};

/**
 * Customer details → (account, for visitors who are not signed in) → review → order, one delivery
 * for every line. The account is created on the server together with the order. Prices always
 * come from the server.
 */
export function CheckoutDialog({
  open,
  onClose,
  lines,
  customer,
  onPlaced,
}: {
  open: boolean;
  onClose: () => void;
  lines: CheckoutLine[];
  customer: CheckoutCustomer | null;
  onPlaced?: () => void;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const needsAccount = !customer;
  const stages: Stage[] = needsAccount ? ["info", "account", "review"] : ["info", "review"];
  const [stage, setStage] = useState<Stage>("info");
  const [account, setAccount] = useState<AccountForm>({ age: "", password: "", confirmPassword: "", referralSource: "", referralOther: "" });
  const [form, setForm] = useState<Form>({
    customerName: customer?.customerName ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    wilayaCode: "",
    commune: "",
    address: "",
    notes: "",
    deliveryMethod: "HOME",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<Quote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const configsKey = JSON.stringify(lines.map((l) => l.config));

  const set = (k: keyof Form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: "" }));
  };
  const setAcc = (k: keyof AccountForm) => (value: string) => {
    setAccount((a) => ({ ...a, [k]: value }));
    setErrors((x) => ({ ...x, [k]: "" }));
  };

  // Server quote (re-priced, with delivery) for the summary.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      api<Quote>("/api/orders/quote", {
        method: "POST",
        json: { items: JSON.parse(configsKey), wilayaCode: form.wilayaCode || undefined, commune: form.commune || undefined, deliveryMethod: form.deliveryMethod },
      })
        .then(setQuote)
        .catch(() => setQuote(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [open, configsKey, form.wilayaCode, form.commune, form.deliveryMethod]);

  // Stop desk not offered for the chosen wilaya → home delivery.
  const stopDeskOffered = quote?.delivery.stopDesk != null;
  const stopDeskBlocked = !!quote && !!form.wilayaCode && !stopDeskOffered && quote.delivery.home != null;
  const method = form.deliveryMethod === "STOP_DESK" && stopDeskBlocked ? "HOME" : form.deliveryMethod;

  const validate = () => {
    const parsed = customerSchema.safeParse({ ...form, deliveryMethod: method, notes: form.notes || undefined });
    if (parsed.success) {
      setErrors({});
      return true;
    }
    const next: Record<string, string> = {};
    for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
    setErrors(next);
    document.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus();
    return false;
  };

  const accountPayload = () => ({ ...account, referralOther: account.referralOther || undefined });

  const validateAccount = () => {
    const parsed = checkoutAccountSchema.safeParse(accountPayload());
    if (parsed.success) {
      setErrors({});
      return true;
    }
    const next: Record<string, string> = {};
    for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
    setErrors(next);
    document.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus();
    return false;
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await api<{ orderNumber: string; token: string }>("/api/orders", {
        method: "POST",
        json: {
          items: JSON.parse(configsKey),
          customer: { ...form, deliveryMethod: method, notes: form.notes || undefined },
          account: needsAccount ? accountPayload() : undefined,
        },
      });
      onPlaced?.();
      router.push(`/order/${encodeURIComponent(res.orderNumber)}?token=${encodeURIComponent(res.token)}`);
      if (needsAccount) router.refresh(); // the header now shows the new account
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, "errors.generic");
      const fields: Record<string, string> = {};
      let back: Stage | null = null;
      for (const [k, v] of Object.entries(err.fields)) {
        fields[k.replace(/^(customer|account)\./, "")] = v;
        back ??= k.startsWith("account.") ? "account" : "info";
      }
      if (back) {
        setErrors(fields);
        setStage(back);
      }
      toast.show(t(err.code), "error");
      setSubmitting(false);
    }
  };

  const fee = quote?.delivery.fee;
  const deliveryLabel = !quote || fee == null ? t("checkout.deliveryPending") : quote.delivery.free || fee === 0 ? t("checkout.deliveryFree") : formatPrice(fee, locale);
  const e = (k: string) => (errors[k] ? t(errors[k]) : null);
  const methodPrice = (m: "HOME" | "STOP_DESK") => {
    if (!quote || !form.wilayaCode) return null;
    const v = m === "HOME" ? quote.delivery.home : quote.delivery.stopDesk;
    if (v == null) return m === "STOP_DESK" && quote.delivery.home != null ? t("checkout.notOffered") : t("checkout.deliveryPending");
    return v === 0 ? t("checkout.deliveryFree") : formatPrice(v, locale);
  };

  return (
    <Dialog open={open} onClose={onClose} title={t("checkout.title")} size="lg" closeLabel={t("common.close")}>
      <div className="flex flex-col gap-6 p-6 md:p-8">
        <StepIndicator steps={stages.map((st) => t(st === "info" ? "checkout.stepInfo" : st === "account" ? "checkout.stepAccount" : "checkout.stepReview"))} current={stages.indexOf(stage)} />

        <ul className="flex flex-col gap-2">
          {lines.map((l, i) => {
            const b = quote?.items[i]?.quote;
            return (
              <li key={i} className="flex items-center gap-4 rounded-field border border-line bg-umber-800/50 p-3">
                {l.product.image && (
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-art">
                    <Image src={l.product.image} alt="" fill sizes="56px" className="object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{l.product.name}</p>
                  <p className="text-xs text-stone tabular-nums">
                    {l.config.widthCm} × {l.config.heightCm} cm{b?.frame ? ` · ${b.frame.name}` : ""}
                    {b?.extras.length ? ` · ${b.extras.map((x) => describeExtra(x)).join(", ")}` : ""} · ×{l.config.quantity}
                  </p>
                </div>
                <p className="font-semibold tabular-nums">{b ? formatPrice(b.total, locale) : "…"}</p>
              </li>
            );
          })}
        </ul>

        <AnimatePresence mode="wait" initial={false}>
          {stage === "info" ? (
            <motion.form
              key="info"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              noValidate
              onSubmit={(ev) => {
                ev.preventDefault();
                if (validate()) setStage(needsAccount ? "account" : "review");
              }}
              className="grid gap-5 sm:grid-cols-2"
            >
              <Field label={t("checkout.fullName")} error={e("customerName")} className="sm:col-span-2">
                {(p) => <Input {...p} name="customerName" autoComplete="name" value={form.customerName} onChange={set("customerName")} required />}
              </Field>
              <Field label={t("checkout.email")} error={e("email")}>
                {(p) => <Input {...p} name="email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} required dir="ltr" />}
              </Field>
              <Field label={t("checkout.phone")} error={e("phone")}>
                {(p) => <Input {...p} name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="05 xx xx xx xx" value={form.phone} onChange={set("phone")} required dir="ltr" />}
              </Field>
              {errors.email === "checkout.emailTaken" && (
                <Link href={`/account/login?next=${encodeURIComponent(pathname)}`} className="-mt-3 text-sm font-semibold text-gold hover:underline sm:col-span-2">
                  {t("checkout.signInInstead")} →
                </Link>
              )}
              <Field label={t("checkout.wilaya")} error={e("wilayaCode")}>
                {(p) => (
                  <Select
                    {...p}
                    name="wilayaCode"
                    value={form.wilayaCode}
                    onChange={(ev) => {
                      setForm((f) => ({ ...f, wilayaCode: ev.target.value, commune: "" }));
                      setErrors((x) => ({ ...x, wilayaCode: "", commune: "" }));
                    }}
                    required
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
              <Field label={t("checkout.commune")} error={e("commune")}>
                {(p) => <CommuneSelect {...p} name="commune" wilayaCode={form.wilayaCode} value={form.commune} onValueChange={(v) => set("commune")({ target: { value: v } })} required />}
              </Field>

              <fieldset className="flex flex-col gap-2 sm:col-span-2">
                <legend className="mb-2 text-[13px] font-semibold text-sand">{t("checkout.deliveryMethod")}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["HOME", "STOP_DESK"] as const).map((m) => {
                    const price = methodPrice(m);
                    const disabled = m === "STOP_DESK" && stopDeskBlocked;
                    return (
                      <label
                        key={m}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-field border px-4 py-3 text-sm transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold",
                          method === m ? "border-gold bg-gold/10" : "border-line-strong hover:border-ivory/50",
                          disabled && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <input type="radio" name="deliveryMethod" className="sr-only" disabled={disabled} checked={method === m} onChange={() => setForm((f) => ({ ...f, deliveryMethod: m }))} />
                        {m === "HOME" ? <Home className="size-4 shrink-0 text-gold" aria-hidden /> : <Store className="size-4 shrink-0 text-gold" aria-hidden />}
                        <span className="flex-1">
                          <span className="block font-semibold">{m === "HOME" ? t("checkout.home") : t("checkout.stopDesk")}</span>
                          <span className="block text-xs text-stone">{m === "HOME" ? t("checkout.homeHint") : t("checkout.stopDeskHint")}</span>
                        </span>
                        {price && <span className="text-sm font-semibold tabular-nums">{price}</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <Field label={method === "STOP_DESK" ? t("checkout.addressStopDesk") : t("checkout.address")} error={e("address")} className="sm:col-span-2">
                {(p) => <Input {...p} name="address" autoComplete="street-address" value={form.address} onChange={set("address")} required />}
              </Field>
              <Field label={t("checkout.notes")} optional={t("common.optional")} error={e("notes")} className="sm:col-span-2">
                {(p) => <Textarea {...p} name="notes" rows={3} className="min-h-24" placeholder={t("checkout.notesPlaceholder")} value={form.notes} onChange={set("notes")} maxLength={1000} />}
              </Field>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" size="lg">
                  {t("common.continue")}
                </Button>
              </div>
            </motion.form>
          ) : stage === "account" ? (
            <motion.form
              key="account"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              noValidate
              onSubmit={(ev) => {
                ev.preventDefault();
                if (validateAccount()) setStage("review");
              }}
              className="grid gap-5 sm:grid-cols-2"
            >
              <div className="flex flex-col gap-1 rounded-field border border-gold/30 bg-gold/5 p-4 sm:col-span-2">
                <p className="font-semibold">{t("checkout.accountTitle")}</p>
                <p className="text-sm text-sand">{t("checkout.accountIntro", { email: form.email })}</p>
                <Link href={`/account/login?next=${encodeURIComponent(pathname)}`} className="mt-1 w-fit text-xs font-semibold text-gold hover:underline">
                  {t("auth.alreadyAccount")}
                </Link>
              </div>
              <Field label={t("auth.password")} error={e("password")} hint={t("auth.passwordHint")}>
                {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" value={account.password} onChange={(ev) => setAcc("password")(ev.target.value)} required />}
              </Field>
              <Field label={t("auth.confirmPassword")} error={e("confirmPassword")}>
                {(p) => <Input {...p} name="confirmPassword" type="password" autoComplete="new-password" value={account.confirmPassword} onChange={(ev) => setAcc("confirmPassword")(ev.target.value)} required />}
              </Field>
              <Field label={t("auth.age")} error={e("age")}>
                {(p) => <Input {...p} name="age" type="number" inputMode="numeric" min={13} max={120} className="max-w-32" value={account.age} onChange={(ev) => setAcc("age")(ev.target.value)} required />}
              </Field>
              <fieldset className="flex flex-col gap-2 sm:col-span-2">
                <legend className="mb-2 text-[13px] font-semibold text-sand">{t("auth.referral")}</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {REFERRAL_SOURCES.map((src) => (
                    <label
                      key={src}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-field border px-3 py-3 text-sm font-semibold transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold",
                        account.referralSource === src ? "border-gold bg-gold/10" : "border-line-strong text-sand hover:border-ivory/50",
                      )}
                    >
                      <input type="radio" name="referralSource" value={src} checked={account.referralSource === src} onChange={() => setAcc("referralSource")(src)} className="size-4 accent-[var(--color-gold)]" />
                      {t(`auth.referralOptions.${src}`)}
                    </label>
                  ))}
                </div>
                {e("referralSource") && <p role="alert" className="text-xs text-ember">⚠ {e("referralSource")}</p>}
              </fieldset>
              {account.referralSource === "OTHER" && (
                <Field label={t("auth.referralOther")} optional={t("common.optional")} className="sm:col-span-2">
                  {(p) => <Input {...p} name="referralOther" value={account.referralOther} onChange={(ev) => setAcc("referralOther")(ev.target.value)} maxLength={120} />}
                </Field>
              )}
              <div className="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-between">
                <Button variant="ghost" type="button" onClick={() => setStage("info")}>
                  <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t("common.back")}
                </Button>
                <Button type="submit" size="lg">
                  {t("common.continue")}
                </Button>
              </div>
            </motion.form>
          ) : (
            <motion.div key="review" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }} className="flex flex-col gap-6">
              <dl className="grid gap-x-6 gap-y-3 rounded-field border border-line p-5 text-sm sm:grid-cols-[auto_1fr]">
                {lines.map((l, i) => {
                  const b = quote?.items[i]?.quote;
                  return (
                    <div key={i} className="contents">
                      <dt className="text-stone">{lines.length > 1 ? `${t("checkout.product")} ${i + 1}` : t("checkout.product")}</dt>
                      <dd>
                        <span className="font-semibold">{l.product.name}</span> — {l.config.widthCm} × {l.config.heightCm} cm × {l.config.quantity}
                        {b && (
                          <span className="block text-xs text-stone tabular-nums">
                            {b.promotionDiscount > 0 ? (
                              <>
                                <s>{formatPrice(b.officialPrice, locale)}</s> → {formatPrice(b.priceAfterPromotion, locale)}
                              </>
                            ) : (
                              formatPrice(b.officialPrice, locale)
                            )}
                            {b.pricingType === "SUR_MESURE" ? ` · ${t("product.pricingSpecial")}` : ""}
                            {b.frame ? ` · ${b.frame.name}` : ""}
                            {b.extras.length ? ` · ${b.extras.map((x) => describeExtra(x)).join(", ")}` : ""}
                            {b.optionsPrice > 0 ? ` (+ ${formatPrice(b.optionsPrice, locale)})` : ""}
                          </span>
                        )}
                      </dd>
                    </div>
                  );
                })}
                <dt className="text-stone">{t("order.deliveryAddress")}</dt>
                <dd>
                  {form.customerName} · <span dir="ltr">{form.phone}</span>
                  <br />
                  {method === "STOP_DESK" ? `${t("checkout.stopDesk")} — ` : ""}
                  {form.address}, {form.commune}, {getWilaya(form.wilayaCode) ? wilayaLabel(getWilaya(form.wilayaCode)!, locale) : ""}
                </dd>
                {needsAccount && (
                  <>
                    <dt className="text-stone">{t("checkout.stepAccount")}</dt>
                    <dd>
                      <span dir="ltr">{form.email}</span>
                      <span className="block text-xs text-stone">{t("checkout.accountWillBeCreated")}</span>
                    </dd>
                  </>
                )}
              </dl>

              <dl className="flex flex-col gap-3 rounded-field bg-umber-800/60 p-5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-sand">{t("checkout.subtotal")}</dt>
                  <dd className="tabular-nums">{quote ? formatPrice(quote.subtotal, locale) : "…"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-sand">
                    {t("checkout.delivery")} ({method === "STOP_DESK" ? t("checkout.stopDesk") : t("checkout.home")})
                  </dt>
                  <dd className="text-end tabular-nums">{deliveryLabel}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-3 text-base">
                  <dt className="font-semibold">{t("checkout.total")}</dt>
                  <dd className="text-xl font-semibold tabular-nums">{quote ? formatPrice(quote.total, locale) : "…"}</dd>
                </div>
                {(!quote || fee == null) && <p className="text-xs text-stone">{t("checkout.deliveryPendingNote")}</p>}
                <p className="text-xs text-stone">{t("checkout.groupNote")}</p>
              </dl>

              <p className="flex items-start gap-2 text-xs text-stone">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t("checkout.paymentNote")}
              </p>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <Button variant="ghost" onClick={() => setStage(needsAccount ? "account" : "info")} disabled={submitting}>
                  <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t("common.back")}
                </Button>
                <Button size="lg" variant="gold" onClick={submit} loading={submitting} disabled={!quote} icon={<Check className="size-4" aria-hidden />}>
                  {submitting ? t("checkout.confirming") : t("checkout.confirm")}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Dialog>
  );
}
