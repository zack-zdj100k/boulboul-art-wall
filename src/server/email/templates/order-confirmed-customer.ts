import { formatPrice, isLocale, type Locale } from "@/i18n/config";
import { describeExtra } from "@/lib/options";
import { emailColors as C, esc, layout, row, sectionTitle } from "./layout";
import type { EmailOrder } from "../types";

// Copy for the customer email. French is the default; the order's locale picks the language.
const COPY = {
  fr: {
    subject: (n: string) => `Votre commande ${n} est confirmée`,
    preheader: "Boulboul Art Wall a confirmé votre commande.",
    title: "Votre commande est confirmée",
    hello: (name: string) => `Bonjour ${name},`,
    intro:
      "Bonne nouvelle : Boulboul Art Wall a vérifié et confirmé votre commande. Elle est maintenant en préparation et entre dans le processus de livraison. Nous vous recontacterons si un détail doit être précisé.",
    order: "Votre commande",
    number: "N° de commande",
    status: "Statut actuel",
    statusValue: "Confirmée — en préparation",
    product: "Produit",
    dims: "Dimensions",
    frame: "Cadre",
    noFrame: "Sans cadre",
    options: "Options",
    none: "Aucune",
    qty: "Quantité",
    products: "Produits",
    negotiated: "Remise accordée",
    finalPrice: "Prix final des produits",
    delivery: "Livraison",
    deliveryPending: "Communiquée par Boulboul",
    stopDesk: "Stop desk",
    grouped: (n: string) => `Livrée avec votre commande ${n} (déjà comptée)`,
    free: "Offerte",
    total: "Total",
    address: "Adresse de livraison",
    thanks: "Merci pour votre confiance.",
    footer: "Vous recevez cet e-mail car vous avez passé une commande sur Boulboul Art Wall.",
  },
  ar: {
    subject: (n: string) => `تم تأكيد طلبك ${n}`,
    preheader: "قام Boulboul Art Wall بتأكيد طلبك.",
    title: "تم تأكيد طلبك",
    hello: (name: string) => `مرحباً ${name}،`,
    intro:
      "خبر سار: قام Boulboul Art Wall بمراجعة طلبك وتأكيده. طلبك الآن قيد التحضير ويدخل مرحلة التوصيل. سنتواصل معك إذا احتجنا إلى توضيح أي تفصيل.",
    order: "طلبك",
    number: "رقم الطلب",
    status: "الحالة الحالية",
    statusValue: "مؤكد — قيد التحضير",
    product: "المنتج",
    dims: "المقاسات",
    frame: "الإطار",
    noFrame: "بدون إطار",
    options: "الإضافات",
    none: "لا شيء",
    qty: "الكمية",
    products: "المنتجات",
    negotiated: "خصم متفق عليه",
    finalPrice: "السعر النهائي للمنتجات",
    delivery: "التوصيل",
    deliveryPending: "يحدده Boulboul",
    stopDesk: "نقطة استلام",
    grouped: (n: string) => `يُسلَّم مع طلبك ${n} (محسوب مسبقاً)`,
    free: "مجاني",
    total: "المجموع",
    address: "عنوان التوصيل",
    thanks: "شكراً لثقتك.",
    footer: "تصلك هذه الرسالة لأنك قمت بطلب على Boulboul Art Wall.",
  },
} as const;

/** Template "order-confirmed-customer" — sent only on the PENDING / CONTACTING → CONFIRMED transition. */
export function orderConfirmedCustomerEmail(order: EmailOrder) {
  const locale: Locale = isLocale(order.locale) ? order.locale : "fr";
  const c = COPY[locale];
  const p = (n: number) => esc(formatPrice(n, locale));
  const subject = c.subject(order.orderNumber);

  const items = order.items
    .map(
      (it) => `<div style="border:1px solid ${C.line};border-radius:10px;padding:16px;margin:0 0 12px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          ${row(c.product, esc(it.productName))}
          ${row(c.dims, `${esc(it.widthCm)} × ${esc(it.heightCm)} cm`)}
          ${row(c.frame, esc(it.frameName ?? c.noFrame))}
          ${row(c.options, it.extras.length ? it.extras.map((e) => esc(describeExtra(e))).join(", ") : c.none)}
          ${row(c.qty, esc(it.quantity))}
        </table>
      </div>`,
    )
    .join("");

  const delivery =
    (order.deliveryMethod === "STOP_DESK" ? `${c.stopDesk} — ` : "") +
    (order.shipsWith ? c.grouped(order.shipsWith) : order.deliveryFee == null ? c.deliveryPending : order.deliveryFee === 0 ? c.free : p(order.deliveryFee));

  const body = `
    <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:26px;font-weight:400">${esc(c.title)}</h1>
    <p style="margin:0 0 12px;font-size:15px">${esc(c.hello(order.customerName))}</p>
    <p style="margin:0;font-size:15px;line-height:1.65;color:${C.ink}">${esc(c.intro)}</p>

    ${sectionTitle(c.order)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${row(c.number, esc(order.orderNumber))}
      ${row(c.status, esc(c.statusValue))}
    </table>
    ${items}

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${row(c.products, p(order.subtotal))}
      ${order.negotiatedDiscount > 0 ? row(c.negotiated, `− ${p(order.negotiatedDiscount)}`) + row(c.finalPrice, p(order.subtotal - order.negotiatedDiscount)) : ""}
      ${row(c.delivery, delivery)}
      ${row(c.total, `<span style="font-size:18px">${p(order.total)}</span>`)}
    </table>

    ${sectionTitle(c.address)}
    <p style="margin:0;font-size:14px;line-height:1.6">${esc(order.customerName)}<br>${esc(order.address)}<br>${esc(order.commune)}, ${esc(
      order.wilayaName,
    )}<br>${esc(order.phone)}</p>

    <p style="margin:28px 0 0;font-size:15px">${esc(c.thanks)}<br><strong>Boulboul Art Wall</strong></p>
  `;

  const text = [
    c.hello(order.customerName),
    c.intro,
    `${c.number}: ${order.orderNumber}`,
    `${c.status}: ${c.statusValue}`,
    ...order.items.map(
      (it) =>
        `- ${it.productName} × ${it.quantity} — ${it.widthCm}×${it.heightCm} cm — ${it.frameName ?? c.noFrame} — ${
          it.extras.map((e) => describeExtra(e)).join(", ") || c.none
        }`,
    ),
    `${c.products}: ${formatPrice(order.subtotal, locale)}`,
    ...(order.negotiatedDiscount > 0
      ? [`${c.negotiated}: − ${formatPrice(order.negotiatedDiscount, locale)}`, `${c.finalPrice}: ${formatPrice(order.subtotal - order.negotiatedDiscount, locale)}`]
      : []),
    `${c.delivery}: ${order.shipsWith ? c.grouped(order.shipsWith) : order.deliveryFee == null ? c.deliveryPending : order.deliveryFee === 0 ? c.free : formatPrice(order.deliveryFee, locale)}`,
    `${c.total}: ${formatPrice(order.total, locale)}`,
    `${c.address}: ${order.address}, ${order.commune}, ${order.wilayaName}`,
    c.thanks,
  ].join("\n");

  return {
    subject,
    text,
    html: layout({
      title: subject,
      preheader: c.preheader,
      body,
      footer: esc(c.footer),
      dir: locale === "ar" ? "rtl" : "ltr",
      lang: locale,
    }),
  };
}
