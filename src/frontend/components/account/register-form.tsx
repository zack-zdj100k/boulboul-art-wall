"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/frontend/components/ui/button";
import { Field, Input } from "@/frontend/components/ui/field";
import { StepIndicator } from "@/frontend/components/ui/step-indicator";
import { useI18n } from "@/shared/i18n/client";
import { api, ApiError } from "@/frontend/lib/api-client";
import { cn } from "@/shared/lib/utils";
import { REFERRAL_SOURCES, registerSchema } from "@/shared/lib/validation";
import { safeNext } from "./login-form";

const STEP_FIELDS = [["fullName", "age"], ["phone", "email"], ["password", "confirmPassword"], ["referralSource", "referralOther"], []] as const;

/** Five short steps (v-form-8 language): one logical group of fields at a time. */
export function RegisterForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [form, setForm] = useState({ fullName: "", age: "", phone: "", email: "", password: "", confirmPassword: "", referralSource: "", referralOther: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const steps = [t("auth.steps.info"), t("auth.steps.contact"), t("auth.steps.security"), t("auth.steps.discovery"), t("auth.steps.confirm")];

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const data = () => ({ ...form, referralOther: form.referralOther || undefined });

  const validate = (fields: readonly string[]) => {
    const parsed = registerSchema.safeParse(data());
    const f: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) if (fields.includes(String(i.path[0]))) f[String(i.path[0])] ??= i.message;
    setErrors(f);
    return Object.keys(f).length === 0;
  };

  const go = (delta: number) => {
    if (delta > 0 && !validate(STEP_FIELDS[step])) return;
    setDir(delta);
    setStep((s) => s + delta);
  };

  const submit = async () => {
    if (!validate(STEP_FIELDS.flat())) return;
    setLoading(true);
    setMessage(null);
    try {
      await api("/api/auth/register", { method: "POST", json: data() });
      router.push(safeNext(next));
      router.refresh();
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError(0, "errors.generic");
      setMessage(t(e.code));
      if (e.fields.email) {
        setErrors(e.fields);
        setStep(1);
      }
      setLoading(false);
    }
  };

  const err = (k: string) => (errors[k] ? t(errors[k]) : null);

  return (
    <div className="flex flex-col gap-8">
      <StepIndicator steps={steps} current={step} label={t("auth.registerTitle")} />
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (step < steps.length - 1) go(1);
          else submit();
        }}
        className="flex flex-col gap-8"
      >
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div key={step} initial={{ opacity: 0, x: 28 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 * dir }} transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }} className="flex min-h-56 flex-col gap-5">
            {step === 0 && (
              <>
                <Field label={t("auth.fullName")} error={err("fullName")}>{(p) => <Input {...p} autoComplete="name" autoFocus value={form.fullName} onChange={(e) => set("fullName")(e.target.value)} />}</Field>
                <Field label={t("auth.age")} error={err("age")}>{(p) => <Input {...p} type="number" inputMode="numeric" min={13} max={120} className="max-w-32" value={form.age} onChange={(e) => set("age")(e.target.value)} />}</Field>
              </>
            )}
            {step === 1 && (
              <>
                <Field label={t("auth.phone")} error={err("phone")}>{(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="05 xx xx xx xx" autoFocus value={form.phone} onChange={(e) => set("phone")(e.target.value)} />}</Field>
                <Field label={t("auth.email")} error={err("email")}>{(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" dir="ltr" value={form.email} onChange={(e) => set("email")(e.target.value)} />}</Field>
              </>
            )}
            {step === 2 && (
              <>
                <Field label={t("auth.password")} error={err("password")} hint={t("auth.passwordHint")}>{(p) => <Input {...p} type="password" autoComplete="new-password" autoFocus value={form.password} onChange={(e) => set("password")(e.target.value)} />}</Field>
                <Field label={t("auth.confirmPassword")} error={err("confirmPassword")}>{(p) => <Input {...p} type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => set("confirmPassword")(e.target.value)} />}</Field>
              </>
            )}
            {step === 3 && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-3 text-[13px] font-semibold text-sand">{t("auth.referral")}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {REFERRAL_SOURCES.map((s) => (
                    <label key={s} className={cn("flex cursor-pointer items-center gap-3 rounded-field border px-4 py-4 font-semibold transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold", form.referralSource === s ? "border-gold bg-gold/10" : "border-line-strong text-sand hover:border-ivory/50")}>
                      <input type="radio" name="referral" value={s} checked={form.referralSource === s} onChange={() => set("referralSource")(s)} className="size-4 accent-[var(--color-gold)]" />
                      {t(`auth.referralOptions.${s}`)}
                    </label>
                  ))}
                </div>
                {err("referralSource") && <p role="alert" className="text-xs text-ember">⚠ {err("referralSource")}</p>}
                {form.referralSource === "OTHER" && (
                  <Field label={t("auth.referralOther")} optional={t("common.optional")}>{(p) => <Input {...p} value={form.referralOther} onChange={(e) => set("referralOther")(e.target.value)} maxLength={120} />}</Field>
                )}
              </fieldset>
            )}
            {step === 4 && (
              <dl className="grid gap-x-6 gap-y-3 rounded-field border border-line p-5 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="text-stone">{t("auth.fullName")}</dt><dd className="font-semibold">{form.fullName}</dd>
                <dt className="text-stone">{t("auth.age")}</dt><dd>{form.age}</dd>
                <dt className="text-stone">{t("auth.phone")}</dt><dd dir="ltr" className="text-start">{form.phone}</dd>
                <dt className="text-stone">{t("auth.email")}</dt><dd dir="ltr" className="text-start">{form.email}</dd>
                <dt className="text-stone">{t("auth.referral")}</dt>
                <dd>{form.referralSource ? t(`auth.referralOptions.${form.referralSource}`) : ""}{form.referralOther ? ` — ${form.referralOther}` : ""}</dd>
              </dl>
            )}
          </motion.div>
        </AnimatePresence>
        {message && <p role="alert" className="rounded-field border border-ember/40 bg-ember/10 px-4 py-3 text-sm">{message}</p>}
        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => go(-1)}><ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t("common.back")}</Button>
          ) : <span />}
          {step < steps.length - 1 ? (
            <Button type="submit">{t("common.continue")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Button>
          ) : (
            <Button type="submit" variant="gold" size="lg" loading={loading}>{loading ? t("auth.registering") : t("auth.register")}</Button>
          )}
        </div>
      </form>
      <p className="text-center text-sm text-sand">
        {t("auth.haveAccount")}{" "}
        <Link href={`/account/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-gold hover:underline">{t("auth.login")}</Link>
      </p>
    </div>
  );
}
