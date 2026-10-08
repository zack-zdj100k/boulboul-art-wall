"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/frontend/components/ui/button";
import { Field, Input } from "@/frontend/components/ui/field";
import { useI18n } from "@/shared/i18n/client";
import { api, ApiError } from "@/frontend/lib/api-client";
import { loginSchema } from "@/shared/lib/validation";

export function safeNext(next: string | null | undefined, fallback = "/account") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = loginSchema.safeParse(form);
        if (!parsed.success) {
          const f: Record<string, string> = {};
          for (const i of parsed.error.issues) f[String(i.path[0])] ??= i.message;
          return setErrors(f);
        }
        setLoading(true);
        setMessage(null);
        try {
          const { user } = await api<{ user: { role: string } }>("/api/auth/login", { method: "POST", json: parsed.data });
          // Signed in/out: load the next page for real (one request with the new session cookie) instead of
          // a client navigation + refresh, which could race and end on "This page couldn't load".
          window.location.assign(safeNext(next, user.role === "ADMIN" ? "/admin" : "/account"));
        } catch (err) {
          setMessage(t(err instanceof ApiError ? err.code : "errors.generic"));
          setLoading(false);
        }
      }}
    >
      <Field label={t("auth.email")} error={errors.email ? t(errors.email) : null}>
        {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" dir="ltr" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />}
      </Field>
      <Field label={t("auth.password")} error={errors.password ? t(errors.password) : null}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />}
      </Field>
      {message && <p role="alert" className="rounded-field border border-ember/40 bg-ember/10 px-4 py-3 text-sm">{message}</p>}
      <Button type="submit" size="lg" loading={loading}>{loading ? t("auth.loggingIn") : t("auth.login")}</Button>
      <p className="text-center text-sm text-sand">
        {t("auth.noAccount")}{" "}
        <Link href={`/account/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-gold hover:underline">{t("auth.registerTitle")}</Link>
      </p>
    </form>
  );
}
