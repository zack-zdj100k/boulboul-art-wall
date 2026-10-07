"use client";

import { AlertTriangle } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// The tab lives in the URL hash (#tarification) so links from the product list and the
// dashboard warning open the pricing directly. Both panes stay mounted to keep unsaved edits.
const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const getHash = () => window.location.hash;

export function ProductAdminTabs({ info, pricing, pricingMissing }: { info: ReactNode; pricing: ReactNode; pricingMissing: boolean }) {
  const hash = useSyncExternalStore(subscribe, getHash, () => "");
  const tab = hash === "#tarification" ? "pricing" : "info";
  const go = (t: "info" | "pricing") => {
    history.replaceState(null, "", t === "pricing" ? "#tarification" : location.pathname + location.search);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };
  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Sections du produit" className="flex gap-1 border-b border-line">
        {(
          [
            ["info", "Informations"],
            ["pricing", "Tarification"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => go(key)}
            className={cn("-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition", tab === key ? "border-gold text-ivory" : "border-transparent text-sand hover:text-ivory")}
          >
            {label}
            {key === "pricing" && pricingMissing && <AlertTriangle className="size-3.5 text-ember" aria-label="Aucun prix configuré" />}
          </button>
        ))}
      </div>
      <div role="tabpanel" hidden={tab !== "info"}>{info}</div>
      <div role="tabpanel" hidden={tab !== "pricing"}>{pricing}</div>
    </div>
  );
}
