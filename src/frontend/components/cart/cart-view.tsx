"use client";

import { Minus, Plus, ShoppingBag, Trash2, UserPlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckoutDialog, type CheckoutCustomer } from "@/frontend/components/product/checkout-dialog";
import { Button, ButtonLink } from "@/frontend/components/ui/button";
import { useI18n } from "@/shared/i18n/client";
import { formatPrice } from "@/shared/i18n/config";
import { api, ApiError } from "@/frontend/lib/api-client";
import { cart, useCart } from "@/frontend/lib/cart";

type Quote = { subtotal: number; items: { quote: { total: number; unitPrice: number } }[] };

/** "Ma commande": every piece the customer wants in the same delivery, priced by the server. */
export function CartView({ customer }: { customer: CheckoutCustomer | null }) {
  const { t, locale } = useI18n();
  const lines = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const key = JSON.stringify(lines.map((l) => l.config));

  useEffect(() => {
    const configs = JSON.parse(key);
    if (!configs.length) return;
    let alive = true;
    api<Quote>("/api/orders/quote", { method: "POST", json: { items: configs } })
      .then((q) => alive && (setQuote(q), setError(null)))
      .catch((e) => alive && (setQuote(null), setError(t(e instanceof ApiError ? e.code : "errors.generic"))));
    return () => {
      alive = false;
    };
  }, [key, t]);

  if (!lines.length) {
    return (
      <div className="flex flex-col items-start gap-5 rounded-panel border border-dashed border-line-strong p-10">
        <p className="text-lg text-sand">{t("cart.empty")}</p>
        <ButtonLink href="/wall-art">{t("order.backToShop")}</ButtonLink>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <ul className="flex flex-col gap-3">
        {lines.map((l, i) => {
          const q = quote?.items[i]?.quote;
          return (
            <li key={l.key} className="flex gap-4 rounded-panel border border-line bg-ink/70 p-4">
              {l.product.image && (
                <Link href={`/wall-art/${l.product.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-art bg-umber-800">
                  <Image src={l.product.image} alt="" fill sizes="96px" className="object-cover" />
                </Link>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/wall-art/${l.product.slug}`} className="font-semibold hover:text-gold">{l.product.name}</Link>
                    <p className="text-xs text-stone tabular-nums">{l.summary}</p>
                  </div>
                  <button type="button" onClick={() => cart.remove(l.key)} aria-label={t("cart.remove")} className="grid size-9 shrink-0 place-items-center rounded-full text-sand hover:bg-ember/10 hover:text-ember">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-auto flex items-center justify-between gap-3">
                  <div className="flex h-10 items-center rounded-full border border-line-strong" role="group" aria-label={t("product.quantity")}>
                    <button type="button" onClick={() => cart.setQuantity(l.key, l.config.quantity - 1)} disabled={l.config.quantity <= 1} className="grid size-10 place-items-center text-sand disabled:opacity-30" aria-label="−">
                      <Minus className="size-3.5" />
                    </button>
                    <output className="w-6 text-center text-sm font-semibold tabular-nums">{l.config.quantity}</output>
                    <button type="button" onClick={() => cart.setQuantity(l.key, l.config.quantity + 1)} className="grid size-10 place-items-center text-sand" aria-label="+">
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <p className="font-semibold tabular-nums">{q ? formatPrice(q.total, locale) : "…"}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="flex h-fit flex-col gap-4 rounded-panel border border-line bg-ink/70 p-6 lg:sticky lg:top-28">
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between"><dt className="text-sand">{t("cart.pieces", { count: lines.reduce((n, l) => n + l.config.quantity, 0) })}</dt><dd className="font-semibold tabular-nums">{quote ? formatPrice(quote.subtotal, locale) : "…"}</dd></div>
          <div className="flex justify-between text-stone"><dt>{t("checkout.delivery")}</dt><dd>{t("cart.deliveryNext")}</dd></div>
        </dl>
        <p className="text-xs text-stone">{t("cart.oneDelivery")}</p>
        {error && <p role="alert" className="text-sm text-ember">{error}</p>}
        {customer ? (
          <Button size="lg" variant="gold" disabled={!quote} onClick={() => setOpen(true)}>
            <ShoppingBag className="size-4" aria-hidden /> {t("cart.checkout")}
          </Button>
        ) : (
          <>
            <ButtonLink href="/account/register?next=%2Fcommande" size="lg" variant="gold">
              <UserPlus className="size-4" aria-hidden /> {t("auth.createToOrder")}
            </ButtonLink>
            <p className="text-center text-xs text-stone">
              {t("auth.accountRequired")}{" "}
              <Link href="/account/login?next=%2Fcommande" className="font-semibold text-gold hover:underline">{t("auth.alreadyAccount")}</Link>
            </p>
          </>
        )}
        <ButtonLink href="/wall-art" variant="ghost" size="sm">{t("cart.continue")}</ButtonLink>
      </aside>

      {quote && customer && <CheckoutDialog open={open} onClose={() => setOpen(false)} lines={lines.map((l) => ({ config: l.config, product: l.product }))} customer={customer} onPlaced={() => cart.clear()} />}
    </div>
  );
}

/** Header badge: only shown when the basket has something in it. */
export function CartBadge({ label }: { label: string }) {
  const lines = useCart();
  const count = lines.reduce((n, l) => n + l.config.quantity, 0);
  if (!count) return null;
  return (
    <Link href="/commande" aria-label={`${label} (${count})`} className="relative grid size-10 place-items-center rounded-full text-sand transition hover:bg-ivory/8 hover:text-ivory">
      <ShoppingBag className="size-[18px]" />
      <span className="absolute -end-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-paper tabular-nums">{count}</span>
    </Link>
  );
}
