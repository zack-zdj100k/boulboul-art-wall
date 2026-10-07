import { formatDate, formatPrice } from "@/shared/i18n/config";
import { describeExtra } from "@/shared/lib/options";
import { button, emailColors as C, esc, layout, row, sectionTitle } from "./layout";
import type { EmailOrder } from "../types";

const STATUS_FR: Record<string, string> = {
  PENDING: "En attente",
  CONTACTING: "Client en cours de contact",
  CONFIRMED: "Confirmée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

const PRICING_TYPE_FR = (it: EmailOrder["items"][number]) =>
  it.pricingType === "PRESET" ? `Mesure proposée${it.pricingLabel ? ` « ${it.pricingLabel} »` : ""}` : it.pricingType === "SUR_MESURE" ? "Sur Mesure (calculé depuis le prix de référence)" : "—";

const promoLabel = (it: EmailOrder["items"][number], p: (n: number) => string) =>
  it.promotionDiscount > 0 ? `− ${p(it.promotionDiscount)}${it.promotionType === "PERCENT" ? ` (${it.promotionValue} %)` : ""}` : "Aucune";

/** Template "new-order-admin" — sent to ADMIN_EMAIL when a customer places an order (status PENDING). */
export function newOrderAdminEmail(order: EmailOrder, opts: { adminOrderUrl: string; appUrl: string }) {
  const p = (n: number) => esc(formatPrice(n, "fr"));
  const subject = `Nouvelle commande — ${order.orderNumber}`;

  const items = order.items
    .map((it) => {
      const img = it.productImageUrl
        ? `<img src="${esc(it.productImageUrl.startsWith("http") ? it.productImageUrl : opts.appUrl + it.productImageUrl)}" alt="" width="96" style="display:block;width:96px;height:auto;border-radius:6px;margin-bottom:12px">`
        : "";
      const extras = it.extras.length ? it.extras.map((e) => `${esc(describeExtra(e))} (${p(e.price)})`).join(", ") : "Aucune";
      return `<div style="border:1px solid ${C.line};border-radius:10px;padding:16px;margin:0 0 12px">
        ${img}
        <p style="margin:0 0 8px;font-size:16px;font-weight:700">${esc(it.productName)}</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          ${row("Dimensions", `${esc(it.widthCm)} × ${esc(it.heightCm)} cm`)}
          ${row("Type de tarif", esc(PRICING_TYPE_FR(it)))}
          ${row("Prix officiel", p(it.officialPrice))}
          ${row("Promotion", promoLabel(it, p))}
          ${row("Prix après promotion", p(it.priceAfterPromotion))}
          ${row("Cadre", esc(it.frameName ?? "Sans cadre"))}
          ${row("Options", extras)}
          ${it.color ? row("Couleur", esc(it.color)) : ""}
          ${row("Quantité × prix unitaire", `${esc(it.quantity)} × ${p(it.unitPrice)}`)}
          ${row("Total article", p(it.totalPrice))}
        </table>
      </div>`;
    })
    .join("");

  const method = order.deliveryMethod === "STOP_DESK" ? "Stop desk" : "À domicile";
  const delivery = order.shipsWith
    ? `${method} — livrée avec ${esc(order.shipsWith)} (frais déjà comptés)`
    : `${method} — ${order.deliveryFee == null ? "à confirmer (aucun tarif pour cette destination)" : order.deliveryFee === 0 ? "offerte" : p(order.deliveryFee)}`;

  const body = `
    <h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:26px;font-weight:400">Nouvelle commande</h1>
    <p style="margin:0;color:${C.muted};font-size:14px">${esc(order.orderNumber)} · ${esc(formatDate(order.createdAt, "fr", true))}</p>

    ${sectionTitle("Client")}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${row("Nom complet", esc(order.customerName))}
      ${row("E-mail", `<a href="mailto:${esc(order.email)}" style="color:${C.ink}">${esc(order.email)}</a>`)}
      ${row("Téléphone", `<a href="tel:${esc(order.phone)}" style="color:${C.ink}">${esc(order.phone)}</a>`)}
      ${row("Wilaya", `${esc(order.wilayaCode)} — ${esc(order.wilayaName)}`)}
      ${row("Commune", esc(order.commune))}
      ${row("Adresse", esc(order.address))}
      ${order.notes ? row("Remarques", esc(order.notes)) : ""}
    </table>

    ${sectionTitle("Articles")}
    ${items}

    ${sectionTitle("Montants")}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${row("Produits (après promotion)", p(order.subtotal))}
      ${row("Négociation", order.negotiatedDiscount > 0 ? `− ${p(order.negotiatedDiscount)}` : "Aucune")}
      ${row("Prix final des produits", p(order.subtotal - order.negotiatedDiscount))}
      ${row("Livraison", delivery)}
      ${row("Total", `<span style="font-size:18px">${p(order.total)}</span>`)}
      ${row("Statut", esc(STATUS_FR[order.status] ?? order.status))}
      ${row("Date de commande", esc(formatDate(order.createdAt, "fr", true)))}
    </table>

    ${button(opts.adminOrderUrl, "Voir la commande")}
  `;

  const text = [
    `Nouvelle commande ${order.orderNumber}`,
    `Client : ${order.customerName} — ${order.email} — ${order.phone}`,
    `Adresse : ${order.address}, ${order.commune}, ${order.wilayaCode} ${order.wilayaName}`,
    ...order.items.map(
      (it) =>
        `- ${it.productName} × ${it.quantity} — ${it.widthCm}×${it.heightCm} cm — tarif : ${PRICING_TYPE_FR(it)} — prix officiel : ${formatPrice(it.officialPrice, "fr")} — promotion : ${
          it.promotionDiscount > 0 ? `− ${formatPrice(it.promotionDiscount, "fr")}` : "aucune"
        } — cadre : ${it.frameName ?? "sans cadre"} — options : ${it.extras.map((e) => describeExtra(e)).join(", ") || "aucune"} — ${formatPrice(it.totalPrice, "fr")}`,
    ),
    `Produits (après promotion) : ${formatPrice(order.subtotal, "fr")}`,
    `Négociation : ${order.negotiatedDiscount > 0 ? `− ${formatPrice(order.negotiatedDiscount, "fr")}` : "aucune"}`,
    `Livraison : ${order.deliveryMethod === "STOP_DESK" ? "stop desk" : "à domicile"} — ${order.shipsWith ? `avec ${order.shipsWith}` : order.deliveryFee == null ? "à confirmer" : formatPrice(order.deliveryFee, "fr")}`,
    `Total : ${formatPrice(order.total, "fr")}`,
    `Statut : ${STATUS_FR[order.status] ?? order.status}`,
    `Voir la commande : ${opts.adminOrderUrl}`,
  ].join("\n");

  return {
    subject,
    text,
    html: layout({
      title: subject,
      preheader: `${order.customerName} — ${formatPrice(order.total, "fr")}`,
      body,
      footer: "Notification automatique de la boutique Boulboul Art Wall.",
    }),
  };
}
