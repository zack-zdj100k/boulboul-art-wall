import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { DeleteOrderButton } from "@/components/admin/delete-order-button";
import { RetryEmailButton } from "@/components/admin/order-actions";
import {
  CustomerQuickActions,
  DeliveryFeePanel,
  DimensionChangePanel,
  ManagerNotesPanel,
  NegotiationPanel,
  OrderStatusPanel,
  ReturnsPanel,
  SeparateDeliveryButton,
} from "@/components/admin/order-manager";
import { ORDER_STATUS_FR, PageHeader, Panel, RETURN_STATUS_FR, RETURN_TYPE_FR, StatusBadge } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPrice } from "@/i18n/config";
import { describeExtra, type ExtraSnapshot } from "@/lib/options";
import { prisma } from "@/server/db";
import { EDITABLE_STATUSES, ORDER_TRANSITIONS, previousStatus } from "@/server/services/order";
import { nextReturnStatuses, returnableQuantities } from "@/server/services/returns";

export const metadata = { title: "Commande" };

const EMAIL_LABEL = { NEW_ORDER_ADMIN: "Nouvelle commande → admin", ORDER_CONFIRMED_CUSTOMER: "Commande confirmée → client", ORDER_DELIVERED_CUSTOMER: "Commande livrée → client" } as const;
const p = (n: number) => formatPrice(n, "fr");
const when = (d: Date) => formatDate(d, "fr", true);

function Line({ label, value, strong, tone }: { label: ReactNode; value: ReactNode; strong?: boolean; tone?: "gold" | "stone" }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t border-line pt-2 text-base font-semibold" : ""} ${tone === "gold" ? "text-gold" : tone === "stone" ? "text-stone" : ""}`}>
      <dt className={strong || tone ? "" : "text-sand"}>{label}</dt>
      <dd className="text-end tabular-nums">{value}</dd>
    </div>
  );
}

type Dims = { widthCm: number; heightCm: number };

export default async function AdminOrderDetail(props: PageProps<"/admin/orders/[id]">) {
  const { id } = await props.params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, _count: { select: { orders: true } } } },
      history: { include: { changedBy: { select: { fullName: true } } }, orderBy: { createdAt: "asc" } },
      adjustments: { include: { actor: { select: { fullName: true } } }, orderBy: { createdAt: "asc" } },
      returns: { include: { history: { include: { changedBy: { select: { fullName: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } },
      items: { orderBy: { id: "asc" } },
      emails: { orderBy: { createdAt: "desc" } },
      shipsWith: { select: { id: true, orderNumber: true, status: true } },
      followers: { select: { id: true, orderNumber: true, status: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();
  const [returnable, previous, catalog] = await Promise.all([
    returnableQuantities(order.id),
    previousStatus(order.id),
    order.status === "DELIVERED"
      ? prisma.product.findMany({
          where: { status: "ACTIVE", archivedAt: null },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            allowCustomSize: true,
            refPrice: true,
            measures: { where: { isActive: true }, orderBy: [{ widthCm: "asc" }, { heightCm: "asc" }], select: { widthCm: true, heightCm: true, label: true } },
            frames: { where: { frame: { isActive: true } }, select: { priceOverride: true, frame: { select: { id: true, name: true, price: true } } } },
            extras: { where: { extra: { isActive: true } }, select: { priceOverride: true, extra: { select: { id: true, name: true, price: true } } } },
          },
        })
      : [],
  ]);

  const editable = EDITABLE_STATUSES.includes(order.status);
  const finalProductPrice = order.subtotal - order.negotiatedDiscount;
  const address = `${order.address}, ${order.commune}, ${order.wilayaCode} — ${order.wilayaName}`;
  const negotiations = order.adjustments.filter((a) => a.kind === "NEGOTIATION");

  // One timeline for everything that happened to the order.
  const events: { at: Date; title: string; by: string | null; note?: string | null; tone?: "gold" }[] = [
    ...order.history.map((h) => ({
      at: h.createdAt,
      title: h.fromStatus ? `${ORDER_STATUS_FR[h.fromStatus]} → ${ORDER_STATUS_FR[h.toStatus]}` : `Commande passée — ${ORDER_STATUS_FR[h.toStatus]}`,
      by: h.changedBy?.fullName ?? (h.fromStatus ? null : "Client"),
      note: h.note,
    })),
    ...order.adjustments.map((a) => {
      const d = (a.details ?? {}) as { from?: Dims | number | null; to?: Dims | number | null };
      const title =
        a.kind === "NEGOTIATION"
          ? (a.discountAmount ?? 0) > 0
            ? `Négociation : − ${p(a.discountAmount ?? 0)}${a.discountPercent != null ? ` (${a.discountPercent} %)` : ""} · produits ${p(a.previousPrice)} → ${p(a.newPrice)}`
            : `Négociation retirée · produits ${p(a.previousPrice)} → ${p(a.newPrice)}`
          : a.kind === "DIMENSION_CHANGE"
            ? `Dimensions ${(d.from as Dims)?.widthCm}×${(d.from as Dims)?.heightCm} → ${(d.to as Dims)?.widthCm}×${(d.to as Dims)?.heightCm} cm · total ${p(a.previousTotal)} → ${p(a.newTotal)}`
            : `Livraison : ${d.from == null ? "à confirmer" : p(d.from as number)} → ${d.to == null ? "à confirmer" : p(d.to as number)}`;
      return { at: a.createdAt, title, by: a.actor?.fullName ?? null, note: a.note, tone: "gold" as const };
    }),
    ...order.returns.flatMap((r) =>
      r.history.map((h) => ({
        at: h.createdAt,
        title: `${RETURN_TYPE_FR[r.type]} : ${h.fromStatus ? `${RETURN_STATUS_FR[h.fromStatus]} → ` : ""}${RETURN_STATUS_FR[h.toStatus]}`,
        by: h.changedBy?.fullName ?? null,
        note: h.note,
      })),
    ),
    ...order.emails.map((m) => ({ at: m.createdAt, title: `E-mail ${m.status === "SENT" ? "envoyé" : "en échec"} : ${EMAIL_LABEL[m.type]}`, by: null })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orders", label: "Commandes" }}
        title={order.orderNumber}
        description={<>Passée le {when(order.createdAt)} · Dernière mise à jour {when(order.updatedAt)} · Paiement à la livraison</>}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={order.status} />
            {order.isDemo && <Badge tone="demo">Démo</Badge>}
            <DeleteOrderButton kind="ORDER" id={order.id} number={order.orderNumber} redirectTo="/admin/orders" />
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Panel title="Statut">
            <OrderStatusPanel orderId={order.id} status={order.status} allowed={ORDER_TRANSITIONS[order.status]} customerEmail={order.email} previous={previous} />
          </Panel>

          <Panel title="Produit & prix">
            <ul className="flex flex-col gap-6">
              {order.items.map((it) => (
                <li key={it.id} className="flex flex-col gap-4">
                  <div className="flex gap-4">
                    {it.productImageUrl && (
                      <div className="relative size-20 shrink-0 overflow-hidden rounded-art bg-umber-800">
                        <Image src={it.productImageUrl} alt="" fill sizes="80px" className="object-cover" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold">
                        {it.productId ? <Link href={`/admin/products/${it.productId}`} className="hover:text-gold">{it.productName}</Link> : it.productName}
                      </p>
                      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sand">
                        <dt className="text-stone">Dimensions</dt><dd className="font-semibold tabular-nums text-ivory">{it.widthCm} × {it.heightCm} cm</dd>
                        <dt className="text-stone">Type de tarif</dt>
                        <dd>
                          {it.pricingType === "SUR_MESURE" ? <Badge tone="gold">Sur Mesure (calculé)</Badge> : it.pricingType === "PRESET" ? `Mesure proposée${it.pricingLabel ? ` · ${it.pricingLabel}` : ""}` : <span className="text-stone">Ancienne tarification</span>}
                        </dd>
                        <dt className="text-stone">Cadre</dt><dd>{it.frameName ?? "Sans cadre"}</dd>
                        <dt className="text-stone">Options</dt><dd>{(it.extras as ExtraSnapshot[]).map((e) => `${describeExtra(e)} (${p(e.price ?? 0)})`).join(", ") || "Aucune"}</dd>
                        {it.color && (<><dt className="text-stone">Couleur</dt><dd>{it.color}</dd></>)}
                        <dt className="text-stone">Quantité</dt><dd className="tabular-nums">{it.quantity}</dd>
                      </dl>
                    </div>
                  </div>
                  <dl className="flex flex-col gap-1.5 rounded-field bg-umber-900 p-4 text-sm">
                    <Line label="Prix officiel" value={p(it.officialPrice)} />
                    <Line
                      label={<>Promotion{it.promotionType === "PERCENT" ? ` (${it.promotionValue} %)` : ""}</>}
                      value={it.promotionDiscount > 0 ? `− ${p(it.promotionDiscount)}` : "Aucune"}
                      tone={it.promotionDiscount > 0 ? "gold" : undefined}
                    />
                    <Line label="Prix après promotion" value={p(it.priceAfterPromotion)} />
                    {it.optionsPrice > 0 && <Line label="Cadre & options" value={`+ ${p(it.optionsPrice)}`} />}
                    <Line label={`Ligne (${it.quantity} × ${p(it.unitPrice)})`} value={p(it.totalPrice)} />
                  </dl>
                </li>
              ))}
            </ul>
            <dl className="mt-6 flex flex-col gap-2 border-t border-line pt-4 text-sm">
              <Line label="Produits après promotion" value={p(order.subtotal)} />
              <Line label="Négociation" value={order.negotiatedDiscount > 0 ? `− ${p(order.negotiatedDiscount)}` : "Aucune"} tone={order.negotiatedDiscount > 0 ? "gold" : undefined} />
              <Line label="Prix final des produits" value={p(finalProductPrice)} />
              <Line
                label={`Livraison (${order.deliveryMethod === "STOP_DESK" ? "stop desk" : "à domicile"})`}
                value={order.shipsWith ? `Comptée sur ${order.shipsWith.orderNumber}` : order.deliveryFee == null ? "À confirmer avec le client" : order.deliveryFee === 0 ? "Offerte" : p(order.deliveryFee)}
              />
              <Line label="Total à encaisser" value={<>{p(order.total)} <span className="text-xs text-stone">{order.currency}</span></>} strong />
            </dl>
          </Panel>

          <Panel title="Négociation">
            <NegotiationPanel orderId={order.id} subtotal={order.subtotal} negotiatedDiscount={order.negotiatedDiscount} deliveryFee={order.deliveryFee} editable={editable} />
            <h3 className="mt-6 mb-2 text-xs font-bold uppercase tracking-[0.12em] text-stone">Historique des négociations</h3>
            {negotiations.length ? (
              <div className="max-w-full overflow-x-auto rounded-field border border-line">
                <table className="w-full min-w-[560px] text-left text-xs [&_td]:border-t [&_td]:border-line [&_td]:px-3 [&_td]:py-2 [&_th]:bg-umber-900 [&_th]:px-3 [&_th]:py-2 [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[0.1em] [&_th]:text-stone">
                  <thead><tr><th>Date</th><th>Gestionnaire</th><th>Prix précédent</th><th>Nouveau prix</th><th>Remise</th><th>Note</th></tr></thead>
                  <tbody>
                    {negotiations.map((a) => (
                      <tr key={a.id}>
                        <td className="whitespace-nowrap">{when(a.createdAt)}</td>
                        <td>{a.actor?.fullName ?? "—"}</td>
                        <td className="tabular-nums">{p(a.previousPrice)}</td>
                        <td className="tabular-nums font-semibold">{p(a.newPrice)}</td>
                        <td className="tabular-nums">{p(a.discountAmount ?? 0)}{a.discountPercent != null ? ` (${a.discountPercent} %)` : ""}</td>
                        <td className="text-sand">{a.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-stone">Aucune négociation.</p>
            )}
          </Panel>

          {editable && (
            <Panel title="Changer les dimensions">
              <div className="flex flex-col gap-6">
                {order.items.map((it) => (
                  <div key={it.id} className="flex flex-col gap-2">
                    {order.items.length > 1 && <p className="text-sm font-semibold">{it.productName}</p>}
                    <DimensionChangePanel orderId={order.id} item={{ id: it.id, widthCm: it.widthCm, heightCm: it.heightCm, productMissing: !it.productId }} negotiatedDiscount={order.negotiatedDiscount} />
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel title="Livraison">
            {order.shipsWith && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-field border border-gold/40 bg-gold/5 p-3 text-sm">
                <p>
                  Un seul colis avec{" "}
                  <Link href={`/admin/orders/${order.shipsWith.id}`} className="font-semibold text-gold hover:underline">{order.shipsWith.orderNumber}</Link> ({ORDER_STATUS_FR[order.shipsWith.status]}) : le client a recommandé avant la livraison, la livraison est comptée une seule fois, sur cette commande.
                </p>
                {editable && <SeparateDeliveryButton orderId={order.id} />}
              </div>
            )}
            {order.followers.length > 0 && (
              <p className="mb-4 rounded-field border border-gold/40 bg-gold/5 p-3 text-sm">
                À livrer avec{" "}
                {order.followers.map((f, i) => (
                  <span key={f.id}>
                    {i > 0 ? ", " : ""}
                    <Link href={`/admin/orders/${f.id}`} className="font-semibold text-gold hover:underline">{f.orderNumber}</Link> ({ORDER_STATUS_FR[f.status]})
                  </span>
                ))}{" "}
                — même client, un seul colis : cette commande porte les frais de livraison.
              </p>
            )}
            <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-stone">Mode</dt><dd>{order.deliveryMethod === "STOP_DESK" ? "Stop desk (point relais)" : "À domicile"}</dd>
              <dt className="text-stone">Wilaya</dt><dd>{order.wilayaCode} — {order.wilayaName}</dd>
              <dt className="text-stone">Commune</dt><dd>{order.commune}</dd>
              <dt className="text-stone">Adresse</dt><dd>{order.address}</dd>
              {order.notes && (<><dt className="text-stone">Remarque client</dt><dd className="whitespace-pre-line">{order.notes}</dd></>)}
            </dl>
            <DeliveryFeePanel orderId={order.id} deliveryFee={order.deliveryFee} editable={editable} />
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Client">
            <p className="text-lg font-semibold">{order.customerName}</p>
            <dl className="mt-2 mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-stone">Téléphone</dt><dd className="tabular-nums" dir="ltr">{order.phone}</dd>
              <dt className="text-stone">E-mail</dt><dd className="break-all">{order.email}</dd>
              <dt className="text-stone">Adresse</dt><dd>{address}</dd>
              <dt className="text-stone">Compte</dt>
              <dd>{order.user ? <Link href={`/admin/customers?q=${encodeURIComponent(order.user.email)}`} className="text-gold hover:underline">Client inscrit · {order.user._count.orders} commande(s)</Link> : "Commande invité"}</dd>
            </dl>
            <CustomerQuickActions name={order.customerName} phone={order.phone} email={order.email} address={address} orderNumber={order.orderNumber} total={order.total} status={order.status} />
          </Panel>

          <Panel title="Chronologie">
            <ol className="relative flex flex-col gap-5 border-s border-line ps-6">
              {events.map((ev, i) => (
                <li key={i} className="relative text-sm">
                  <span className={`absolute -start-[31px] top-1 size-3 rounded-full border-2 bg-ink ${ev.tone === "gold" ? "border-gold" : "border-sand"}`} aria-hidden />
                  <p className="font-semibold">{ev.title}</p>
                  <p className="text-xs text-stone">{when(ev.at)}{ev.by ? ` · ${ev.by}` : ""}</p>
                  {ev.note && <p className="mt-1 text-sand">{ev.note}</p>}
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Notes privées">
            <ManagerNotesPanel orderId={order.id} notes={order.managerNotes ?? ""} />
          </Panel>

          <div id="retours" className="scroll-mt-24">
            <Panel title="Retours & échanges" actions={<Link href="/admin/returns" className="text-xs font-semibold text-stone hover:text-ivory">Toutes les demandes</Link>}>
              <ReturnsPanel
                orderId={order.id}
                delivered={order.status === "DELIVERED"}
                items={order.items.map((it) => ({ id: it.id, productId: it.productId, name: it.productName, widthCm: it.widthCm, heightCm: it.heightCm, unitPrice: it.unitPrice, returnable: returnable.get(it.id) ?? 0 }))}
                products={catalog.map((p) => ({
                  id: p.id,
                  name: p.name,
                  measures: p.measures,
                  surMesure: p.allowCustomSize && !!p.refPrice,
                  frames: p.frames.map((f) => ({ id: f.frame.id, name: f.frame.name, price: f.priceOverride ?? f.frame.price })),
                  extras: p.extras.map((x) => ({ id: x.extra.id, name: x.extra.name, price: x.priceOverride ?? x.extra.price })),
                }))}
                requests={order.returns.map((r) => {
                  const it = order.items.find((i) => i.id === r.orderItemId);
                  return {
                    id: r.id,
                    type: r.type,
                    status: r.status,
                    quantity: r.quantity,
                    reason: r.reason,
                    details: r.details,
                    managerNote: r.managerNote,
                    source: r.source,
                    createdAt: when(r.createdAt),
                    item: it ? { name: it.productName, widthCm: it.widthCm, heightCm: it.heightCm, unitPrice: it.unitPrice } : null,
                    replacement:
                      r.replacementWidthCm && r.replacementHeightCm
                        ? {
                            productName: r.replacementProductName,
                            widthCm: r.replacementWidthCm,
                            heightCm: r.replacementHeightCm,
                            frameName: r.replacementFrameName,
                            extras: ((r.replacementExtras as { name: string }[] | null) ?? []).map((x) => x.name),
                            pricingType: r.replacementPricingType,
                            price: r.replacementPrice,
                          }
                        : null,
                    next: nextReturnStatuses(r.type, r.status),
                  };
                })}
              />
            </Panel>
          </div>

          <Panel title="E-mails">
            {order.emails.length ? (
              <ul className="flex flex-col gap-3">
                {order.emails.map((m) => (
                  <li key={m.id} className="rounded-field border border-line p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{EMAIL_LABEL[m.type]}</span>
                      <Badge tone={m.status === "SENT" ? "sage" : "ember"}>{m.status === "SENT" ? "Envoyé" : "Échec"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-stone">{when(m.createdAt)} · {m.to} · {m.provider}</p>
                    {m.error && <p className="mt-2 break-words text-xs text-ember">{m.error}</p>}
                    {m.status === "FAILED" && <div className="mt-2"><RetryEmailButton orderId={order.id} type={m.type} /></div>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone">Aucun e-mail envoyé pour cette commande.</p>
            )}
            <p className="mt-3 text-xs text-stone">Notifications : nouvelle commande → admin, confirmation → client, livraison → client. Réglages dans Paramètres → E-mails.</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
