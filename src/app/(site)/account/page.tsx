import type { Metadata } from "next";
import Link from "next/link";
import { ProfileForm, SignOutButton } from "@/components/account/account-actions";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, formatPrice } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mon compte", robots: { index: false } };

const TABS = ["overview", "orders", "custom", "profile"] as const;
type Tab = (typeof TABS)[number];

const STATUS_TONE: Record<string, "neutral" | "gold" | "sage" | "ember" | "outline"> = {
  PENDING: "outline",
  CONFIRMED: "gold",
  CONTACTING: "neutral",
  DELIVERED: "sage",
  CANCELLED: "ember",
};

export default async function AccountPage(props: PageProps<"/account">) {
  const sessionUser = await requireUser("/account");
  const sp = await props.searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "overview";
  const { t, locale } = await getI18n();

  // Every query is scoped to the signed-in user's id — customers only ever see their own data.
  const [user, orders, requests] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id }, select: { fullName: true, email: true, phone: true, age: true, createdAt: true } }),
    prisma.order.findMany({
      where: { userId: sessionUser.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, orderNumber: true, createdAt: true, total: true, status: true, items: { select: { productName: true, quantity: true } } },
    }),
    prisma.customOrder.findMany({
      where: { userId: sessionUser.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true, createdAt: true, status: true, description: true, widthCm: true, heightCm: true, total: true },
    }),
  ]);

  const orderList = (list: typeof orders) =>
    list.length ? (
      <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line">
        {list.map((o) => (
          <li key={o.id} className="grid gap-3 bg-umber-950 p-5 sm:grid-cols-[1.2fr_1fr_auto_auto] sm:items-center sm:gap-6">
            <div>
              <p className="font-semibold tabular-nums">{o.orderNumber}</p>
              <p className="text-xs text-stone">{formatDate(o.createdAt, locale)}</p>
            </div>
            <p className="text-sm text-sand">{o.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ")}</p>
            <p className="font-semibold tabular-nums">{formatPrice(o.total, locale)}</p>
            <div className="flex items-center gap-3">
              <Badge tone={STATUS_TONE[o.status]}>{t(`order.statuses.${o.status}`)}</Badge>
              <Link href={`/order/${o.orderNumber}`} className="text-sm font-semibold text-gold hover:underline">{t("account.viewOrder")}</Link>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <div className="flex flex-col items-start gap-4 rounded-panel border border-dashed border-line-strong p-8">
        <p className="text-sand">{t("account.noOrders")}</p>
        <ButtonLink href="/wall-art" variant="outline" size="sm">{t("home.finalCta")}</ButtonLink>
      </div>
    );

  const requestList = (list: typeof requests) =>
    list.length ? (
      <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line">
        {list.map((r) => (
          <li key={r.id} className="grid gap-2 bg-umber-950 p-5 sm:grid-cols-[1fr_2fr_auto] sm:items-center sm:gap-6">
            <div>
              <p className="font-semibold tabular-nums">{r.reference}</p>
              <p className="text-xs text-stone">{formatDate(r.createdAt, locale)}</p>
            </div>
            <p className="line-clamp-2 text-sm text-sand">{r.description || (r.widthCm && r.heightCm ? `${r.widthCm} × ${r.heightCm} cm` : "—")}</p>
            <div className="flex items-center gap-3">
              {r.total != null && <span className="font-semibold tabular-nums">{formatPrice(r.total, locale)}</span>}
              <Badge tone={r.status === "APPROVED" || r.status === "COMPLETED" ? "sage" : r.status === "REJECTED" ? "ember" : "outline"}>{t(`account.customStatuses.${r.status}`)}</Badge>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <div className="flex flex-col items-start gap-4 rounded-panel border border-dashed border-line-strong p-8">
        <p className="text-sand">{t("account.noCustom")}</p>
        <ButtonLink href="/customize" variant="outline" size="sm">{t("home.customCta")}</ButtonLink>
      </div>
    );

  return (
    <div className="container-page pt-32 pb-28 md:pt-40">
      <header className="flex flex-col gap-6 border-b border-line pb-10 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3">
          <p className="eyebrow">{t("account.title")}</p>
          <h1 className="font-display text-title font-light">{t("account.hello", { name: user.fullName.split(" ")[0] })}</h1>
          <p className="text-sm text-stone">{t("account.memberSince", { date: formatDate(user.createdAt, locale) })}</p>
        </div>
        <SignOutButton />
      </header>

      <nav aria-label={t("account.title")} className="scrollbar-none -mx-4 mt-8 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {TABS.map((k) => (
            <li key={k}>
              <Link
                href={k === "overview" ? "/account" : `/account?tab=${k}`}
                aria-current={tab === k ? "page" : undefined}
                className={cn("block whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-semibold transition", tab === k ? "bg-ivory text-ink" : "text-sand hover:bg-ivory/8 hover:text-ivory")}
              >
                {t(`account.tabs.${k}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 flex flex-col gap-12">
        {tab === "overview" && (
          <>
            <section aria-labelledby="ov-orders" className="flex flex-col gap-5">
              <h2 id="ov-orders" className="font-display text-2xl">{t("account.orders")}</h2>
              {orderList(orders.slice(0, 3))}
            </section>
            <section aria-labelledby="ov-custom" className="flex flex-col gap-5">
              <h2 id="ov-custom" className="font-display text-2xl">{t("account.customRequests")}</h2>
              {requestList(requests.slice(0, 3))}
            </section>
          </>
        )}
        {tab === "orders" && (
          <section aria-labelledby="t-orders" className="flex flex-col gap-5">
            <h2 id="t-orders" className="font-display text-2xl">{t("account.orders")}</h2>
            {orderList(orders)}
          </section>
        )}
        {tab === "custom" && (
          <section aria-labelledby="t-custom" className="flex flex-col gap-5">
            <h2 id="t-custom" className="font-display text-2xl">{t("account.customRequests")}</h2>
            {requestList(requests)}
          </section>
        )}
        {tab === "profile" && (
          <section aria-labelledby="t-profile" className="flex flex-col gap-6">
            <h2 id="t-profile" className="font-display text-2xl">{t("account.profile")}</h2>
            <ProfileForm initial={{ fullName: user.fullName, phone: user.phone ?? "", age: user.age ? String(user.age) : "" }} email={user.email} />
          </section>
        )}
      </div>
    </div>
  );
}
