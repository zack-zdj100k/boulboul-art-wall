"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { api, ApiError } from "@/lib/api-client";
import { profileSchema } from "@/lib/validation";

export function SignOutButton() {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        await api("/api/auth/logout", { method: "POST" }).catch(() => {});
        router.push("/");
        router.refresh();
      }}
    >
      <LogOut className="size-3.5" aria-hidden /> {t("common.signOut")}
    </Button>
  );
}

export function ProfileForm({ initial, email }: { initial: { fullName: string; phone: string; age: string }; email: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  return (
    <form
      noValidate
      className="grid max-w-xl gap-5 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = profileSchema.safeParse({ ...form, age: form.age || undefined });
        if (!parsed.success) {
          const f: Record<string, string> = {};
          for (const i of parsed.error.issues) f[String(i.path[0])] ??= i.message;
          return setErrors(f);
        }
        setErrors({});
        setLoading(true);
        try {
          await api("/api/account/profile", { method: "PATCH", json: parsed.data });
          toast.show(t("account.profileSaved"), "success");
          router.refresh();
        } catch (err) {
          toast.show(t(err instanceof ApiError ? err.code : "errors.generic"), "error");
        } finally {
          setLoading(false);
        }
      }}
    >
      <Field label={t("auth.fullName")} error={errors.fullName ? t(errors.fullName) : null} className="sm:col-span-2">
        {(p) => <Input {...p} value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />}
      </Field>
      <Field label={t("auth.phone")} error={errors.phone ? t(errors.phone) : null}>
        {(p) => <Input {...p} type="tel" dir="ltr" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />}
      </Field>
      <Field label={t("auth.age")} error={errors.age ? t(errors.age) : null}>
        {(p) => <Input {...p} type="number" value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} />}
      </Field>
      <Field label={t("auth.email")} className="sm:col-span-2">
        {(p) => <Input {...p} value={email} disabled dir="ltr" />}
      </Field>
      <div>
        <Button type="submit" loading={loading}>{t("account.saveProfile")}</Button>
      </div>
    </form>
  );
}
