"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error.digest ?? error.message);
  }, [error]);
  return (
    <div className="container-page flex min-h-[70dvh] flex-col items-start justify-center gap-6 pt-32">
      <p className="eyebrow">Boulboul Art Wall</p>
      <h1 className="font-display text-title font-light">{t("errors.generic")}</h1>
      {error.digest && <p className="text-xs text-stone">Réf. {error.digest}</p>}
      <Button onClick={reset}>{t("common.retry")}</Button>
    </div>
  );
}
