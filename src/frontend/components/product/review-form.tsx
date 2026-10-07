"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/frontend/components/ui/button";
import { Field, Textarea } from "@/frontend/components/ui/field";
import { StarInput } from "@/frontend/components/ui/stars";
import { useI18n } from "@/shared/i18n/client";
import { api, ApiError } from "@/frontend/lib/api-client";
import { reviewSchema } from "@/shared/lib/validation";

export function ReviewForm({ productId, signedIn, slug }: { productId: string; signedIn: boolean; slug: string }) {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <p className="text-sm text-sand">
        <Link href={`/account/login?next=/wall-art/${slug}`} className="font-semibold text-gold hover:underline">
          {t("reviews.loginToReview")}
        </Link>
      </p>
    );
  }
  if (state === "done") return <p role="status" className="rounded-field border border-sage/40 bg-sage/10 p-4 text-sm text-ivory">{t("reviews.pending")}</p>;

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = reviewSchema.safeParse({ productId, rating, comment });
        if (!parsed.success) {
          const next: Record<string, string> = {};
          for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
          setErrors(next);
          return;
        }
        setState("sending");
        try {
          await api("/api/reviews", { method: "POST", json: parsed.data });
          setState("done");
        } catch (err) {
          setMessage(t(err instanceof ApiError ? err.code : "errors.generic"));
          setState("idle");
        }
      }}
    >
      <StarInput value={rating} onChange={(v) => { setRating(v); setErrors((x) => ({ ...x, rating: "" })); }} label={t("reviews.rating")} />
      {errors.rating && <p role="alert" className="-mt-3 text-xs text-ember">{t(errors.rating)}</p>}
      <Field label={t("reviews.comment")} error={errors.comment ? t(errors.comment) : null}>
        {(p) => <Textarea {...p} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1500} />}
      </Field>
      {message && <p role="alert" className="text-sm text-ember">{message}</p>}
      <div>
        <Button type="submit" loading={state === "sending"}>{t("reviews.send")}</Button>
      </div>
    </form>
  );
}
