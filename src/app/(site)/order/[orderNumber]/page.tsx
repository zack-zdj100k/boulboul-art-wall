import { CheckCircle2 } from "lucide-react";
import { describeExtra, type ExtraSnapshot } from "@/lib/options";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReturnRequestSection } from "@/components/order/return-request";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { formatDate, formatPrice } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { canAccessOrder } from "@/server/auth/order-access";
import { getCurrentUser } from "@/server/auth/session";
import { getLegal } from "@/server/cms-content";
import { returnableQuantities } from "@/server/services/returns";
import { prisma } from "@/server/db";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Order confirmation — visible to the owner, or to whoever holds the order's private token. */
export default async function OrderPage(props: PageProps<"/order/[orderNumber]">) {
  const { orderNumber } = await props.params;
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const { t, locale } = await getI18n();
  const [order, user] = await Promise.all([
    prisma.order.findUnique({ where: { orderNumber: decodeURIComponent(orderNumber) }, include: { items: true, returns: { orderBy: { createdAt: "desc" } } } }),
    getCurrentUser(),
  ]);
  const allowed = order && canAccessOrder(order, user, token, { allowAdmin: true });
  if (!order || !allowed) notFound();
  const hasPolicy = !!(await getLegal("legal.returns", locale));
  const returnable = await returnableQuantities(order.id);

  return (
    <div className="wall-surface grain min-h-dvh">
      <div className="container-page flex max-w-3xl flex-col gap-10 pt-36 pb-28">
        <Reveal className="flex flex-col items-start gap-5">
          <span className="grid size-14 place-items-center rounded-full bg-gold/15 text-gold shadow-glow">
            <CheckCircle2 className="size-7" aria-hidden />
          </span>
          {order.status === "PENDING" ? (
            <>
              <h1 className="font-display text-title font-light text-balance">{t("order.successTitle")}</h1>
              <p className="text-lg leading-relaxed text-sand">{t("order.successText", { number: order.orderNumber })}</p>
            </>
          ) : (
            <h1 className="font-display text-title font-light text-balance">{t("order.title", { number: order.orderNumber })}</h1>
          )}
        </Reveal>

        <Reveal delay={0.1} className="overflow-hidden rounded-panel border border-line bg-ink/70 backdrop-blur">
          <dl className="grid grid-cols-2 gap-px bg-line text-sm sm:grid-cols-3">
            {[
              [t("order.number"), order.orderNumber],
              [t("order.date"), formatDate(order.createdAt, locale, true)],
              [t("order.status"), t(`order.statuses.${order.status}`)],
            ].map(([k, v]) => (
              <div key={k} className="bg-umber-950 p-5">
                <dt className="text-xs text-stone">{k}</dt>
                <dd className="mt-1 font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="divide-y divide-line">
            {order.items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div>
                  <p className="font-semibold">{it.productName}</p>
                  <p className="text-sm text-stone tabular-nums">
                    {it.widthCm} × {it.heightCm} cm · {it.frameName ?? t("product.noFrame")}
                    {(it.extras as ExtraSnapshot[]).length > 0 && ` · ${(it.extras as ExtraSnapshot[]).map(describeExtra).join(", ")}`} · ×{it.quantity}
                  </p>
                </div>
                <p className="font-semibold tabular-nums">{formatPrice(it.totalPrice, locale)}</p>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-2 border-t border-line p-5 text-sm">
            <div className="flex justify-between"><dt className="text-sand">{t("checkout.subtotal")}</dt><dd className="tabular-nums">{formatPrice(order.subtotal, locale)}</dd></div>
            {order.negotiatedDiscount > 0 && (
              <div className="flex justify-between text-gold"><dt>{t("order.negotiated")}</dt><dd className="tabular-nums">− {formatPrice(order.negotiatedDiscount, locale)}</dd></div>
            )}
            <div className="flex justify-between gap-4"><dt className="text-sand">{t("checkout.delivery")}</dt><dd className="text-end tabular-nums">{order.deliveryFee == null ? t("checkout.deliveryPending") : order.deliveryFee === 0 ? t("checkout.deliveryFree") : formatPrice(order.deliveryFee, locale)}</dd></div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>{t("checkout.total")}</dt><dd className="tabular-nums">{formatPrice(order.total, locale)}</dd></div>
          </dl>
          <div className="border-t border-line p-5 text-sm text-sand">
            <p className="text-xs text-stone">{t("order.deliveryAddress")}</p>
            <p className="mt-1">{order.customerName} · <span dir="ltr">{order.phone}</span><br />{order.address}, {order.commune}, {order.wilayaName}</p>
          </div>
        </Reveal>

        {(order.status === "DELIVERED" || order.returns.length > 0) && (
          <ReturnRequestSection
            orderNumber={order.orderNumber}
            token={token}
            hasPolicy={hasPolicy}
            delivered={order.status === "DELIVERED"}
            items={order.items.map((it) => ({ id: it.id, name: it.productName, widthCm: it.widthCm, heightCm: it.heightCm, returnable: returnable.get(it.id) ?? 0 }))}
            requests={order.returns.map((r) => ({ id: r.id, type: r.type, status: r.status, reason: r.reason, createdAt: r.createdAt.toISOString() }))}
          />
        )}

        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/wall-art">{t("order.backToShop")}</ButtonLink>
          {user && <ButtonLink href="/account" variant="outline">{t("nav.account")}</ButtonLink>}
        </div>
      </div>
    </div>
  );
}
