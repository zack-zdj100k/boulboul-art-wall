"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useI18n } from "@/shared/i18n/client";
import { loadCommunes, type Commune } from "@/shared/lib/communes";
import { Select } from "./field";

/** Communes of the chosen wilaya (value = official French name, label in the visitor's language). */
export function CommuneSelect({ wilayaCode, value, onValueChange, ...props }: { wilayaCode: string; value: string; onValueChange: (v: string) => void } & Omit<ComponentProps<"select">, "value" | "onChange">) {
  const { t, locale } = useI18n();
  const [all, setAll] = useState<Record<string, Commune[]> | null>(null);
  useEffect(() => {
    let alive = true;
    loadCommunes().then((d) => alive && setAll(d.communes));
    return () => {
      alive = false;
    };
  }, []);
  const list = all?.[wilayaCode] ?? [];
  const sorted = locale === "ar" ? [...list].sort((a, b) => a[1].localeCompare(b[1], "ar")) : list;
  return (
    <Select {...props} value={value} onChange={(e) => onValueChange(e.target.value)} disabled={!wilayaCode || !all || props.disabled}>
      <option value="">{!wilayaCode ? t("checkout.chooseWilayaFirst") : !all ? "…" : t("checkout.selectCommune")}</option>
      {sorted.map(([fr, ar]) => (
        <option key={fr} value={fr}>
          {locale === "ar" ? ar : fr}
        </option>
      ))}
    </Select>
  );
}
