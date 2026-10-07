"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/frontend/components/ui/button";
import { Field, Input, Select } from "@/frontend/components/ui/field";
import { useToast } from "@/frontend/components/ui/toast";
import { TRAFFIC_SOURCES, campaignLink, slugify } from "@/shared/lib/traffic";

const NETWORKS = ["instagram", "tiktok", "facebook", "snapchat", "youtube", "whatsapp", "pinterest", "x", "linkedin", "google"] as const;
const PLACEMENTS = [
  { value: "bio", label: "Lien en bio / profil" },
  { value: "story", label: "Story" },
  { value: "post", label: "Publication / vidéo" },
  { value: "paid", label: "Publicité sponsorisée (boost)" },
  { value: "message", label: "Message privé / groupe" },
  { value: "influencer", label: "Influenceur / partenaire" },
];

/** Builds tracked links (utm_*) so each post, story or sponsored ad shows up in the report. */
export function CampaignLinkBuilder({ baseUrl, pages }: { baseUrl: string; pages: { path: string; label: string }[] }) {
  const toast = useToast();
  const [network, setNetwork] = useState<string>("instagram");
  const [placement, setPlacement] = useState("bio");
  const [campaign, setCampaign] = useState("");
  const [path, setPath] = useState("/");
  const [copied, setCopied] = useState(false);

  const link = useMemo(() => campaignLink(baseUrl, path, { source: network, medium: placement, campaign }), [baseUrl, path, network, placement, campaign]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.show("Copie impossible : sélectionnez le lien et copiez-le manuellement.", "error");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Réseau">
          {(p) => (
            <Select {...p} value={network} onChange={(e) => setNetwork(e.target.value)}>
              {NETWORKS.map((n) => (
                <option key={n} value={n}>{TRAFFIC_SOURCES[n].label}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Emplacement">
          {(p) => (
            <Select {...p} value={placement} onChange={(e) => setPlacement(e.target.value)}>
              {PLACEMENTS.map((pl) => (
                <option key={pl.value} value={pl.value}>{pl.label}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Nom de la campagne" optional="facultatif" hint={campaign ? `Enregistré : ${slugify(campaign) ?? "—"}` : "ex. ramadan-2027, miroirs-led"}>
          {(p) => <Input {...p} value={campaign} onChange={(e) => setCampaign(e.target.value)} maxLength={60} />}
        </Field>
        <Field label="Page d'arrivée">
          {(p) => (
            <Select {...p} value={path} onChange={(e) => setPath(e.target.value)}>
              {pages.map((pg) => (
                <option key={pg.path} value={pg.path}>{pg.label}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="flex flex-col gap-3 rounded-field border border-gold/30 bg-gold/5 p-4 md:flex-row md:items-center">
        <Link2 className="hidden size-4 shrink-0 text-gold md:block" aria-hidden />
        <code dir="ltr" className="min-w-0 flex-1 break-all text-sm text-ivory select-all">{link}</code>
        <Button size="sm" variant="gold" onClick={copy} icon={copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}>
          {copied ? "Copié" : "Copier le lien"}
        </Button>
      </div>
      <p className="text-xs text-stone">
        Utilisez un lien différent pour chaque publication ou publicité : les visites, comptes créés, commandes et ventes de ce lien
        apparaîtront dans « Campagnes » ci-dessus. Sans lien suivi, la source est quand même détectée (application Instagram,
        TikTok, Facebook… ou site d&apos;origine) quand c&apos;est possible.
      </p>
    </div>
  );
}
