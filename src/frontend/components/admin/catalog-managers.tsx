"use client";

import Image from "next/image";
import { Badge } from "@/frontend/components/ui/badge";
import { formatPrice } from "@/shared/i18n/config";
import { WILAYAS } from "@/shared/lib/algeria";
import { CrudManager } from "./crud-manager";

type Row = Record<string, unknown> & { id: string };
const money = (v: unknown) => formatPrice(Number(v ?? 0), "fr");

export function CategoriesManager({ items }: { items: Row[] }) {
  return (
    <CrudManager
      endpoint="/api/admin/categories"
      itemLabel="une catégorie"
      items={items}
      deleteWarning="Les produits de cette catégorie seront conservés, sans catégorie."
      defaults={{ name: "", nameAr: "", slug: "", description: "", descriptionAr: "", imageId: "", imageUrl: "", sortOrder: 0, isActive: true }}
      fields={[
        { key: "name", label: "Nom (FR)", type: "text", required: true },
        { key: "slug", label: "Slug (URL)", type: "text", help: "Laissé vide : généré depuis le nom." },
        { key: "nameAr", label: "Nom (AR)", type: "text", dir: "rtl" },
        { key: "description", label: "Description (FR)", type: "textarea" },
        { key: "descriptionAr", label: "Description (AR)", type: "textarea", dir: "rtl" },
        { key: "imageId", label: "Image de la catégorie", type: "image", previewKey: "imageUrl", help: "Sinon, l'image d'un produit est utilisée." },
        { key: "sortOrder", label: "Ordre d'affichage", type: "number" },
        { key: "isActive", label: "Visible sur le site", type: "checkbox" },
      ]}
      columns={[
        {
          label: "Nom",
          render: (i) => (
            <span className="flex items-center gap-3">
              {i.imageUrl ? (
                <span className="relative size-10 overflow-hidden rounded-art">
                  <Image src={String(i.imageUrl)} alt="" fill sizes="40px" className="object-cover" />
                </span>
              ) : null}
              <span>
                <span className="font-semibold">{String(i.name)}</span>
                <span className="block text-xs text-stone">/{String(i.slug)}</span>
              </span>
            </span>
          ),
        },
        { label: "Produits", render: (i) => `${i.productCount ?? 0} produit(s)` },
        { label: "Statut", render: (i) => (i.isActive ? <Badge tone="sage">Visible</Badge> : <Badge>Masquée</Badge>) },
      ]}
    />
  );
}

export function FramesManager({ items }: { items: Row[] }) {
  return (
    <CrudManager
      endpoint="/api/admin/frames"
      itemLabel="un cadre"
      items={items}
      deleteWarning="Il sera retiré des produits qui le proposent (les commandes passées restent intactes)."
      defaults={{ name: "", nameAr: "", description: "", swatch: "#151515", imageId: "", imageUrl: "", priceType: "FIXED", price: 0, isActive: true, isDemo: false, sortOrder: 0 }}
      fields={[
        { key: "name", label: "Nom (FR)", type: "text", required: true },
        { key: "swatch", label: "Couleur (pastille)", type: "color" },
        { key: "nameAr", label: "Nom (AR)", type: "text", dir: "rtl" },
        {
          key: "priceType",
          label: "Mode de prix",
          type: "select",
          options: [
            { value: "FIXED", label: "Montant fixe par article" },
            { value: "PER_METER", label: "Par mètre de périmètre" },
          ],
        },
        { key: "price", label: "Prix (DA)", type: "number", help: "Par article, ou par mètre de périmètre." },
        { key: "description", label: "Description", type: "textarea" },
        { key: "sortOrder", label: "Ordre", type: "number" },
        { key: "isActive", label: "Actif", type: "checkbox" },
        { key: "isDemo", label: "Donnée de démonstration", type: "checkbox", help: "Décochez une fois le prix réel saisi." },
      ]}
      columns={[
        {
          label: "Cadre",
          render: (i) => (
            <span className="flex items-center gap-3">
              <span className="size-6 rounded-[4px] border-[3px]" style={{ borderColor: String(i.swatch || "#555") }} />
              <span className="font-semibold">{String(i.name)}</span>
              {i.isDemo ? <Badge tone="demo">Démo</Badge> : null}
            </span>
          ),
        },
        { label: "Prix", render: (i) => `${money(i.price)}${i.priceType === "PER_METER" ? " / m" : ""}` },
        { label: "Statut", render: (i) => (i.isActive ? <Badge tone="sage">Actif</Badge> : <Badge>Inactif</Badge>) },
      ]}
    />
  );
}

export function ExtrasManager({ items }: { items: Row[] }) {
  return (
    <CrudManager
      endpoint="/api/admin/extras"
      itemLabel="une option"
      items={items}
      defaults={{ name: "", nameAr: "", description: "", price: 0, isActive: true, availableForCustom: true, isDemo: false, sortOrder: 0, colors: [], askNote: false, notePrompt: "", notePromptAr: "" }}
      fields={[
        { key: "name", label: "Nom (FR)", type: "text", required: true },
        { key: "price", label: "Prix (DA)", type: "number" },
        { key: "nameAr", label: "Nom (AR)", type: "text", dir: "rtl" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "sortOrder", label: "Ordre", type: "number" },
        { key: "isActive", label: "Active", type: "checkbox" },
        { key: "availableForCustom", label: "Proposée dans le formulaire sur mesure", type: "checkbox" },
        { key: "colors", label: "Couleurs proposées au client", type: "colors", help: "Ex. pour une LED : blanc chaud, blanc froid, RGB… Laissez vide si l'option n'a pas de couleur." },
        { key: "askNote", label: "Demander une précision au client", type: "checkbox", help: "Ex. pour un miroir : où le placer dans le cadre." },
        { key: "notePrompt", label: "Question posée (FR)", type: "text" },
        { key: "notePromptAr", label: "Question posée (AR)", type: "text", dir: "rtl" },
        { key: "isDemo", label: "Donnée de démonstration", type: "checkbox" },
      ]}
      columns={[
        {
          label: "Option",
          render: (i) => (
            <span className="flex flex-wrap items-center gap-2 font-semibold">
              {String(i.name)}
              {Array.isArray(i.colors) &&
                (i.colors as { name: string; hex: string }[]).map((c) => <span key={c.name} title={c.name} className="size-3.5 rounded-full ring-1 ring-ivory/20" style={{ background: c.hex }} />)}
              {i.askNote ? <Badge tone="outline">Précision</Badge> : null}
              {i.isDemo ? <Badge tone="demo">Démo</Badge> : null}
            </span>
          ),
        },
        { label: "Prix", render: (i) => money(i.price) },
        { label: "Sur mesure", render: (i) => (i.availableForCustom ? "Oui" : "Non") },
        { label: "Statut", render: (i) => (i.isActive ? <Badge tone="sage">Active</Badge> : <Badge>Inactive</Badge>) },
      ]}
    />
  );
}

export function DeliveryRulesManager({ items }: { items: Row[] }) {
  return (
    <CrudManager
      endpoint="/api/admin/delivery-rules"
      itemLabel="une règle de livraison"
      items={items}
      searchText={(i) => `${i.wilayaCode ?? ""} ${WILAYAS.find((w) => w.code === i.wilayaCode)?.fr ?? "par défaut"} ${i.commune ?? ""}`}
      searchPlaceholder="Wilaya, numéro ou commune…"
      pageSize={8}
      defaults={{ wilayaCode: "", commune: "", fee: 0, stopDeskFee: "", returnFee: "", freeAbove: "", isActive: true, note: "" }}
      fields={[
        { key: "wilayaCode", label: "Wilaya", type: "select", options: [{ value: "", label: "Toutes (tarif par défaut)" }, ...WILAYAS.map((w) => ({ value: w.code, label: `${w.code} — ${w.fr}` }))] },
        { key: "commune", label: "Commune (facultatif)", type: "text", help: "Tarif spécifique à une commune de la wilaya." },
        { key: "fee", label: "À domicile (DA)", type: "number" },
        { key: "stopDeskFee", label: "Stop desk (DA)", type: "number", help: "Laisser vide : stop desk non proposé dans cette zone." },
        { key: "returnFee", label: "Frais de retour transporteur (DA)", type: "number", help: "Information pour l'équipe (colis refusé ou retourné)." },
        { key: "freeAbove", label: "Livraison offerte dès (DA)", type: "number", help: "Laisser vide : jamais offerte." },
        { key: "note", label: "Note interne", type: "text" },
        { key: "isActive", label: "Active", type: "checkbox" },
      ]}
      columns={[
        {
          label: "Zone",
          render: (i) => (
            <span className="font-semibold">
              {i.wilayaCode ? `${i.wilayaCode} — ${WILAYAS.find((w) => w.code === i.wilayaCode)?.fr ?? ""}` : "Par défaut (toutes wilayas)"}
              {i.commune ? ` · ${i.commune}` : ""}
            </span>
          ),
        },
        { label: "Domicile", render: (i) => money(i.fee) },
        { label: "Stop desk", render: (i) => (i.stopDeskFee != null && i.stopDeskFee !== "" ? money(i.stopDeskFee) : "—") },
        { label: "Retour", render: (i) => (i.returnFee != null && i.returnFee !== "" ? money(i.returnFee) : "—") },
        { label: "Offerte dès", render: (i) => (i.freeAbove ? money(i.freeAbove) : "—") },
        { label: "Statut", render: (i) => (i.isActive ? <Badge tone="sage">Active</Badge> : <Badge>Inactive</Badge>) },
      ]}
    />
  );
}
