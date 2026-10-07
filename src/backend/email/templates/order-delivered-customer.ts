import { formatPrice, isLocale, type Locale } from "@/shared/i18n/config";
import { describeExtra } from "@/shared/lib/options";
import { button, emailColors as C, esc, layout, row, sectionTitle } from "./layout";
import type { EmailOrder } from "../types";

const COPY = {
  fr: {
    subject: (n: string) => `Votre commande ${n} a été livrée`,
    preheader: "Votre création Boulboul Art Wall est arrivée.",
    title: "Votre commande est livrée",
    hello: (name: string) => `Bonjour ${name},`,
    intro: "Votre commande a été livrée. Nous espérons que votre nouvelle pièce vous plaît et qu'elle habille joliment votre mur.",
    order: "Votre commande",
    number: "N° de commande",
    dims: "Dimensions",
    qty: "Quantité",
    total: "Total",
    help: "Un souci avec votre commande ? Depuis la page de votre commande, vous pouvez demander un retour ou un échange.",
    cta: "Voir ma commande",
    thanks: "Merci pour votre confiance.",
    footer: "Vous recevez cet e-mail car vous avez passé une commande sur Boulboul Art Wall.",
  },
  ar: {
    subject: (n: string) => `تم تسليم طلبك ${n}`,
    preheader: "وصلت قطعتك من Boulboul Art Wall.",
    title: "تم تسليم طلبك",
    hello: (name: string) => `مرحباً ${name}،`,
    intro: "تم تسليم طلبك. نتمنى أن تعجبك قطعتك الجديدة وأن تزيّن جدارك.",
    order: "طلبك",
    number: "رقم الطلب",
    dims: "المقاسات",
    qty: "الكمية",
    total: "المجموع",
    help: "هل هناك مشكلة في طلبك؟ يمكنك طلب إرجاع أو استبدال من صفحة طلبك.",
    cta: "عرض طلبي",
    thanks: "شكراً لثقتك.",
    footer: "تصلك هذه الرسالة لأنك قمت بطلب على Boulboul Art Wall.",
  },
} as const;

/** Template "order-delivered-customer" — sent once, when the order is marked delivered. */
export function orderDeliveredCustomerEmail(order: EmailOrder, opts: { orderUrl: string }) {
  const locale: Locale = isLocale(order.locale) ? order.locale : "fr";
  const c = COPY[locale];
  const subject = c.subject(order.orderNumber);
  const items = order.items
    .map(
      (it) => `<div style="border:1px solid ${C.line};border-radius:10px;padding:16px;margin:0 0 12px">
        <p style="margin:0 0 8px;font-size:15px;font-weight:700">${esc(it.productName)}</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          ${row(c.dims, `${esc(it.widthCm)} × ${esc(it.heightCm)} cm${it.frameName ? ` · ${esc(it.frameName)}` : ""}${it.extras.length ? ` · ${it.extras.map((e) => esc(describeExtra(e))).join(", ")}` : ""}`)}
          ${row(c.qty, esc(it.quantity))}
        </table>
      </div>`,
    )
    .join("");

  const body = `
    <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:26px;font-weight:400">${esc(c.title)}</h1>
    <p style="margin:0 0 12px;font-size:15px">${esc(c.hello(order.customerName))}</p>
    <p style="margin:0;font-size:15px;line-height:1.65">${esc(c.intro)}</p>
    ${sectionTitle(c.order)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${row(c.number, esc(order.orderNumber))}
      ${row(c.total, esc(formatPrice(order.total, locale)))}
    </table>
    ${items}
    <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:${C.muted}">${esc(c.help)}</p>
    ${button(opts.orderUrl, c.cta)}
    <p style="margin:28px 0 0;font-size:15px">${esc(c.thanks)}<br><strong>Boulboul Art Wall</strong></p>
  `;
  const text = [
    c.hello(order.customerName),
    c.intro,
    `${c.number}: ${order.orderNumber}`,
    ...order.items.map((it) => `- ${it.productName} × ${it.quantity} — ${it.widthCm}×${it.heightCm} cm`),
    `${c.total}: ${formatPrice(order.total, locale)}`,
    c.help,
    opts.orderUrl,
    c.thanks,
  ].join("\n");
  return { subject, text, html: layout({ title: subject, preheader: c.preheader, body, footer: esc(c.footer), dir: locale === "ar" ? "rtl" : "ltr", lang: locale }) };
}
