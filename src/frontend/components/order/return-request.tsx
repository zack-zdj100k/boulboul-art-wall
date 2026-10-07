"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/frontend/components/ui/button";
import { Field, Input, Select, Textarea } from "@/frontend/components/ui/field";
import { useToast } from "@/frontend/components/ui/toast";
import { useI18n } from "@/shared/i18n/client";
import { formatDate } from "@/shared/i18n/config";
import { api, ApiError } from "@/frontend/lib/api-client";
import { RETURN_REASON_KEYS } from "@/shared/lib/returns";
import { returnRequestSchema } from "@/shared/lib/validation";

type Request = { id: string; type: "RETURN" | "EXCHANGE"; status: string; reason: string; createdAt: string };

/** Customer return / exchange request on a delivered order. No email is sent — Boulboul follows up. */
type Item = { id: string; name: string; widthCm: number; heightCm: number; returnable: number };

export function ReturnRequestSection({ orderNumber, token, items, requests, hasPolicy, delivered }: { orderNumber: string; token: string; items: Item[]; requests: Request[]; hasPolicy: boolean; delivered: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const returnable = items.filter((i) => i.returnable > 0);
  const canRequest = delivered && returnable.length > 0;
  const [form, setForm] = useState({ type: "", itemId: returnable[0]?.id ?? "", quantity: "1", reason: "", details: "", w: "", h: "" });
  const item = returnable.find((i) => i.id === form.itemId) ?? returnable[0];
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const base = `/api/orders/${encodeURIComponent(orderNumber)}/returns`;

  const submit = async () => {
    const parsed = returnRequestSchema.safeParse({
      type: form.type || undefined,
      orderItemId: item?.id,
      quantity: form.quantity,
      reason: form.reason || undefined,
      details: form.details || undefined,
      replacementWidthCm: form.type === "EXCHANGE" && form.w ? form.w : undefined,
      replacementHeightCm: form.type === "EXCHANGE" && form.h ? form.h : undefined,
      token: token || undefined,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      return setErrors(next);
    }
    setBusy(true);
    try {
      await api(base, { method: "POST", json: parsed.data });
      toast.show(t("returns.sent"), "success");
      setForm({ type: "", itemId: returnable[0]?.id ?? "", quantity: "1", reason: "", details: "", w: "", h: "" });
      router.refresh();
    } catch (e) {
      toast.show(t(e instanceof ApiError ? e.code : "errors.generic"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="returns-title" className="flex flex-col gap-5 rounded-panel border border-line bg-ink/70 p-6">
      <div className="flex flex-col gap-2">
        <h2 id="returns-title" className="font-display text-2xl">{t("returns.title")}</h2>
        <p className="text-sm text-sand">{t("returns.intro")}</p>
        {hasPolicy && (
          <Link href="/legal/returns" className="text-sm font-semibold text-gold hover:underline">
            {t("returns.policyLink")}
          </Link>
        )}
      </div>

      {requests.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label={t("returns.yourRequests")}>
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-line px-4 py-3 text-sm">
              <span>
                <strong>{t(`returns.${r.type}`)}</strong> · {r.reason}
                <span className="block text-xs text-stone">{formatDate(r.createdAt, locale)}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="rounded-full bg-ivory/8 px-3 py-1 text-xs font-semibold text-sand">{t(`returns.statuses.${r.status}`)}</span>
                {r.status === "REQUESTED" && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-ember hover:underline"
                    onClick={async () => {
                      try {
                        await api(`${base}?id=${encodeURIComponent(r.id)}${token ? `&token=${encodeURIComponent(token)}` : ""}`, { method: "DELETE" });
                        toast.show(t("returns.cancelled"), "success");
                        router.refresh();
                      } catch (e) {
                        toast.show(t(e instanceof ApiError ? e.code : "errors.generic"), "error");
                      }
                    }}
                  >
                    {t("returns.cancel")}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canRequest ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-wrap gap-2 sm:col-span-2" role="radiogroup" aria-label={t("returns.type")}>
            {(["EXCHANGE", "RETURN"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={form.type === k}
                onClick={() => setForm({ ...form, type: k })}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${form.type === k ? "border-gold bg-gold/10 text-ivory" : "border-line-strong text-sand hover:border-ivory/50"}`}
              >
                {t(`returns.${k}_LONG`)}
              </button>
            ))}
            {errors.type && <p role="alert" className="w-full text-xs text-ember">{t(errors.type)}</p>}
          </div>
          {returnable.length > 1 && (
            <Field label={t("returns.item")}>
              {(p) => (
                <Select {...p} value={item?.id} onChange={(e) => setForm({ ...form, itemId: e.target.value, quantity: "1" })}>
                  {returnable.map((i) => <option key={i.id} value={i.id}>{i.name} — {i.widthCm} × {i.heightCm} cm</option>)}
                </Select>
              )}
            </Field>
          )}
          {item && item.returnable > 1 && (
            <Field label={t("returns.quantity", { max: item.returnable })}>
              {(p) => <Input {...p} type="number" min={1} max={item.returnable} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />}
            </Field>
          )}
          {form.type === "EXCHANGE" && (
            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <p className="col-span-2 text-xs text-stone">{t("returns.wantedMeasure", { w: item?.widthCm ?? "", h: item?.heightCm ?? "" })}</p>
              <Field label={`${t("product.width")} (${t("common.cm")})`} optional={t("common.optional")}>
                {(p) => <Input {...p} type="number" min={1} value={form.w} onChange={(e) => setForm({ ...form, w: e.target.value })} />}
              </Field>
              <Field label={`${t("product.height")} (${t("common.cm")})`} optional={t("common.optional")}>
                {(p) => <Input {...p} type="number" min={1} value={form.h} onChange={(e) => setForm({ ...form, h: e.target.value })} />}
              </Field>
            </div>
          )}
          <Field label={t("returns.reason")} error={errors.reason ? t(errors.reason) : null}>
            {(p) => (
              <Select {...p} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                <option value="">—</option>
                {RETURN_REASON_KEYS.map((k) => <option key={k} value={k}>{t(`returns.reasons.${k}`)}</option>)}
              </Select>
            )}
          </Field>
          <Field label={t("returns.details")} optional={t("common.optional")}>
            {(p) => <Textarea {...p} rows={2} className="min-h-12" maxLength={2000} placeholder={t("returns.reasonPlaceholder")} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />}
          </Field>
          <div className="sm:col-span-2">
            <Button onClick={submit} loading={busy}>{form.type === "EXCHANGE" ? t("returns.sendExchange") : form.type === "RETURN" ? t("returns.sendReturn") : t("returns.send")}</Button>
          </div>
        </div>
      ) : (
        requests.length === 0 && <p className="text-sm text-stone">{t("returns.notDelivered")}</p>
      )}
    </section>
  );
}
