import Link from "next/link";
import { z } from "zod";
import { Empty, PageHeader, RETURN_STATUS_FR, RETURN_TYPE_FR, StatusBadge, Table } from "@/components/admin/ui";
import { formatDate, formatPrice } from "@/i18n/config";
import { RETURN_STATUSES } from "@/lib/admin-validation";
import { cn } from "@/lib/utils";
import { listReturnRequests } from "@/server/services/returns";

export const metadata = { title: "Retours & échanges" };

const schema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  status: z.enum(["OPEN", "ALL", ...RETURN_STATUSES]).optional().catch(undefined),
});

export default async function AdminReturns(props: PageProps<"/admin/returns">) {
  const sp = await props.searchParams;
  const query = schema.parse({ q: typeof sp.q === "string" ? sp.q : undefined, status: typeof sp.status === "string" ? sp.status : "OPEN" });
  const rows = await listReturnRequests(query);
  const href = (status?: string) => `/admin/returns?${new URLSearchParams(Object.entries({ q: query.q, status: status ?? "ALL" }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <PageHeader
        title="Retours & échanges"
        description={
          <>
            Demandes sur des commandes livrées. Le prix enregistré des commandes n&apos;est jamais modifié. Les conditions affichées au client se rédigent dans{" "}
            <Link href="/admin/cms/legal.returns" className="text-gold hover:underline">CMS → Politique de retours &amp; échanges</Link>.
          </>
        }
      />
      <div className="mb-6 flex flex-col gap-4">
        <form method="get" className="flex gap-2">
          {query.status && <input type="hidden" name="status" value={query.status} />}
          <input name="q" defaultValue={query.q} placeholder="N° de commande, client, téléphone…" aria-label="Rechercher" className="h-11 min-w-0 flex-1 rounded-field border border-line-strong bg-umber-900 px-4 text-sm focus:border-gold focus:outline-none" />
          <button className="h-11 rounded-full bg-ivory px-5 text-sm font-bold text-ink">Rechercher</button>
        </form>
        <ul className="scrollbar-none flex gap-2 overflow-x-auto" aria-label="Statut">
          {[["OPEN", "En cours"], ["ALL", "Toutes"], ...RETURN_STATUSES.map((s) => [s, RETURN_STATUS_FR[s]])].map(([value, label]) => {
            const active = (query.status ?? "ALL") === value;
            return (
              <li key={value}>
                <Link href={href(value)} aria-current={active ? "page" : undefined} className={cn("block whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-semibold", active ? "border-ivory bg-ivory text-ink" : "border-line text-sand hover:text-ivory")}>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      {rows.length ? (
        <Table>
          <thead>
            <tr><th>Commande</th><th>Type</th><th>Client</th><th>Article</th><th>Motif</th><th>Total commande</th><th>Statut</th><th>Date</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/orders/${r.order.id}#retours`} className="font-semibold text-ivory hover:text-gold">{r.order.orderNumber}</Link></td>
                <td>{RETURN_TYPE_FR[r.type]} × {r.quantity}</td>
                <td>{r.order.customerName}<span className="block text-xs text-stone tabular-nums">{r.order.phone}</span></td>
                <td className="text-sand">
                  {r.orderItem ? `${r.orderItem.productName} — ${r.orderItem.widthCm} × ${r.orderItem.heightCm}` : "—"}
                  {r.replacementWidthCm && <span className="block text-xs text-gold">→ {r.replacementWidthCm} × {r.replacementHeightCm} cm{r.replacementPrice != null ? ` · ${formatPrice(r.replacementPrice, "fr")}` : ""}</span>}
                </td>
                <td className="max-w-64 truncate text-sand">{r.reason}</td>
                <td className="tabular-nums">{formatPrice(r.order.total, "fr")}</td>
                <td><StatusBadge status={r.status} labels={RETURN_STATUS_FR} /></td>
                <td className="whitespace-nowrap text-xs text-stone">{formatDate(r.createdAt, "fr", true)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>Aucune demande.</Empty>
      )}
    </>
  );
}
