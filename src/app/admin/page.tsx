import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Empty, PageHeader, Panel, StatusBadge, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPrice } from "@/i18n/config";
import { getDashboardStats, hasDemoData } from "@/server/services/stats";

export const metadata = { title: "Tableau de bord" };

export default async function AdminDashboard() {
  const [s, demo] = await Promise.all([getDashboardStats(), hasDemoData()]);
  const cards = [
    { label: "Commandes", value: s.totalOrders, href: "/admin/orders" },
    { label: "En attente", value: s.pending, href: "/admin/orders?status=PENDING", highlight: s.pending > 0 },
    { label: "Client en contact", value: s.contacting, href: "/admin/orders?status=CONTACTING" },
    { label: "Confirmées", value: s.confirmed, href: "/admin/orders?status=CONFIRMED" },
    { label: "Livrées", value: s.delivered, href: "/admin/orders?status=DELIVERED" },
    { label: "Annulées", value: s.cancelled, href: "/admin/orders?status=CANCELLED" },
    { label: "Demandes sur mesure", value: s.customRequests, sub: `${s.customPending} à traiter`, href: "/admin/custom-orders" },
    { label: "Retours / échanges ouverts", value: s.openReturns, href: "/admin/returns", highlight: s.openReturns > 0 },
  ];

  return (
    <>
      <PageHeader title="Tableau de bord" description="Chiffres calculés en direct depuis la base de données." />

      <div className="mb-8 flex flex-col gap-3">
        {demo && (
          <Link href="/admin/settings#demo" className="flex items-start gap-3 rounded-panel border border-dashed border-gold/60 bg-gold/5 p-4 text-sm">
            <Badge tone="demo">Démo</Badge>
            <span className="flex-1 text-sand">
              Le site contient des <strong className="text-ivory">données de démonstration</strong> (produits, prix, commandes de test). Remplacez-les par vos vraies informations ou supprimez-les depuis les paramètres.
            </span>
            <ArrowRight className="mt-0.5 size-4 shrink-0" />
          </Link>
        )}
        {s.failedEmails > 0 && (
          <Link href="/admin/orders" className="flex items-center gap-3 rounded-panel border border-ember/50 bg-ember/10 p-4 text-sm">
            <AlertTriangle className="size-4 text-ember" />
            <span>{s.failedEmails} e-mail(s) non envoyé(s) ces 7 derniers jours — ouvrez la commande concernée pour réessayer.</span>
          </Link>
        )}
        {s.unpricedProducts > 0 && (
          <Link href="/admin/products?pricing=missing" className="flex items-center gap-3 rounded-panel border border-ember/50 bg-ember/10 p-4 text-sm">
            <AlertTriangle className="size-4 shrink-0 text-ember" />
            <span>
              {s.unpricedProducts} produit(s) en ligne sans aucun prix configuré : les clients ne peuvent pas les commander. Ajoutez des prix dans l&apos;onglet « Tarification » du produit.
            </span>
          </Link>
        )}
        {s.pendingReviews > 0 && (
          <Link href="/admin/reviews?status=PENDING" className="flex items-center gap-3 rounded-panel border border-line bg-ink/60 p-4 text-sm text-sand hover:text-ivory">
            {s.pendingReviews} avis en attente de modération <ArrowRight className="size-4" />
          </Link>
        )}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="col-span-2 rounded-panel border border-gold/30 bg-gradient-to-br from-gold/12 to-transparent p-6 md:col-span-4 lg:col-span-2 lg:row-span-2">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold">Chiffre d&apos;affaires</p>
          <p className="mt-3 font-display text-4xl tabular-nums md:text-5xl">{formatPrice(s.revenue, "fr")}</p>
          <dl className="mt-4 flex flex-col gap-1 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-sand">Commandes livrées ({s.delivered})</dt><dd className="tabular-nums">{formatPrice(s.revenueDelivered, "fr")}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-sand">Retours ({s.returnsDone})</dt><dd className="tabular-nums">{s.revenueRefunds ? `− ${formatPrice(s.revenueRefunds, "fr")}` : "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-sand">Échanges ({s.exchangesDone})</dt><dd className="tabular-nums">{s.revenueExchanges ? `${s.revenueExchanges > 0 ? "+" : "−"} ${formatPrice(Math.abs(s.revenueExchanges), "fr")}` : "—"}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-stone">
            Une commande compte quand elle est <strong>livrée</strong> (montant final : promotion, négociation et livraison). Un retour est déduit automatiquement dès que la pièce est reçue ; un échange terminé ajoute ou retire sa différence de prix. En cours (pas encore livré) : {formatPrice(s.toCollect, "fr")}.
          </p>
        </div>
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`rounded-panel border p-5 transition hover:border-ivory/30 ${c.highlight ? "border-gold/50 bg-gold/5" : "border-line bg-ink/60"}`}>
            <p className="text-xs font-semibold text-stone">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{c.value}</p>
            {c.sub && <p className="mt-1 text-xs text-sand">{c.sub}</p>}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Commandes récentes" actions={<Link href="/admin/orders" className="text-xs font-semibold text-gold">Tout voir</Link>}>
          {s.recentOrders.length ? (
            <Table>
              <thead>
                <tr><th>N°</th><th>Client</th><th>Wilaya</th><th>Total</th><th>Statut</th><th>Date</th></tr>
              </thead>
              <tbody>
                {s.recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/admin/orders/${o.id}`} className="font-semibold text-gold hover:underline tabular-nums">{o.orderNumber}</Link> {o.isDemo && <Badge tone="demo">Démo</Badge>}</td>
                    <td>{o.customerName}</td>
                    <td>{o.wilayaName}</td>
                    <td className="tabular-nums">{formatPrice(o.total, "fr")}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="text-stone">{formatDate(o.createdAt, "fr", true)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty>Aucune commande pour le moment.</Empty>
          )}
        </Panel>
        <Panel title="Meilleures ventes">
          {s.bestSellers.length ? (
            <ol className="flex flex-col gap-3">
              {s.bestSellers.map((b, i) => (
                <li key={`${b.productId}-${i}`} className="flex items-center gap-3 text-sm">
                  <span className="font-display text-lg text-gold tabular-nums">{i + 1}</span>
                  <span className="flex-1 truncate">{b.name}</span>
                  <span className="text-stone tabular-nums">×{b.quantity}</span>
                  <span className="w-28 text-end tabular-nums">{formatPrice(b.revenue, "fr")}</span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Les ventes apparaîtront ici une fois les commandes livrées.</Empty>
          )}
        </Panel>
      </div>
    </>
  );
}
