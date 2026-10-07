import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { DeleteOrderButton } from "@/frontend/components/admin/delete-order-button";
import { CUSTOM_STATUS_FR, Empty, ORDER_STATUS_FR, PageHeader, StatusBadge, Table } from "@/frontend/components/admin/ui";
import { Badge } from "@/frontend/components/ui/badge";
import { Pagination } from "@/frontend/components/ui/pagination";
import { formatDate, formatPrice } from "@/shared/i18n/config";
import { cn } from "@/shared/lib/utils";
import { searchAllOrders } from "@/backend/services/admin-queries";

export const metadata = { title: "Commandes" };

const schema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  type: z.enum(["ORDER", "CUSTOM"]).optional().catch(undefined),
  status: z.string().max(20).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});

const TYPES = [
  { value: undefined, label: "Toutes" },
  { value: "ORDER", label: "Catalogue" },
  { value: "CUSTOM", label: "Sur mesure" },
] as const;

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn("block whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-semibold", active ? "border-ivory bg-ivory text-ink" : "border-line text-sand hover:text-ivory")}>
      {children}
    </Link>
  );
}

export default async function AdminOrders(props: PageProps<"/admin/orders">) {
  const sp = await props.searchParams;
  const query = schema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const result = await searchAllOrders(query);
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ q: query.q, type: query.type, status: query.status, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/orders${p.size ? `?${p}` : ""}`;
  };
  const statusLabels = query.type === "CUSTOM" ? CUSTOM_STATUS_FR : ORDER_STATUS_FR;

  return (
    <>
      <PageHeader title="Commandes" description="Commandes du catalogue et demandes sur mesure, réunies. Recherchez par numéro, nom, e-mail, téléphone ou wilaya." />
      <div className="mb-6 flex flex-col gap-4">
        <form method="get" className="flex gap-2">
          {query.type && <input type="hidden" name="type" value={query.type} />}
          {query.status && <input type="hidden" name="status" value={query.status} />}
          <input name="q" defaultValue={query.q} placeholder="Rechercher…" aria-label="Rechercher une commande" className="h-11 min-w-0 flex-1 rounded-field border border-line-strong bg-umber-900 px-4 text-sm focus:border-gold focus:outline-none" />
          <button className="h-11 rounded-full bg-ivory px-5 text-sm font-bold text-ink">Rechercher</button>
        </form>
        <ul className="scrollbar-none flex gap-2 overflow-x-auto" aria-label="Type">
          {TYPES.map((t) => (
            <li key={t.label}>
              <Chip href={href({ type: t.value, status: undefined, page: undefined })} active={query.type === t.value}>
                {t.label}
              </Chip>
            </li>
          ))}
        </ul>
        {query.type && (
          <ul className="scrollbar-none flex gap-2 overflow-x-auto" aria-label="Statut">
            {[undefined, ...Object.keys(statusLabels)].map((s) => (
              <li key={s ?? "all"}>
                <Chip href={href({ status: s, page: undefined })} active={query.status === s}>
                  {s ? statusLabels[s] : "Tous les statuts"}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </div>
      {result.rows.length ? (
        <Table>
          <thead>
            <tr><th>N°</th><th>Type</th><th>Client</th><th>Téléphone</th><th>Détail</th><th>Wilaya</th><th>Total</th><th>Statut</th><th>Date</th><th><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {result.rows.map((o) => (
              <tr key={o.kind + o.id}>
                <td className="whitespace-nowrap">
                  <Link href={o.href} className="font-semibold text-gold hover:underline tabular-nums">{o.number}</Link>
                  {o.isDemo && <Badge tone="demo" className="ms-2">Démo</Badge>}
                  {o.emailFailed && <AlertTriangle className="ms-2 inline size-3.5 text-ember" aria-label="E-mail en échec" />}
                </td>
                <td>{o.kind === "CUSTOM" ? <Badge tone="gold">Sur mesure</Badge> : <Badge tone="outline">Catalogue</Badge>}</td>
                <td>{o.customerName}</td>
                <td className="tabular-nums">{o.phone}</td>
                <td className="max-w-56 truncate text-sand">{o.summary || "—"}</td>
                <td>{o.place ?? "—"}</td>
                <td className="whitespace-nowrap tabular-nums">{o.total != null ? formatPrice(o.total, "fr") : <span className="text-stone">À chiffrer</span>}</td>
                <td><StatusBadge status={o.status} labels={o.kind === "CUSTOM" ? CUSTOM_STATUS_FR : ORDER_STATUS_FR} /></td>
                <td className="whitespace-nowrap text-stone">{formatDate(o.createdAt, "fr", true)}</td>
                <td><DeleteOrderButton kind={o.kind} id={o.id} number={o.number} compact /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>Aucune commande ne correspond.</Empty>
      )}
      <div className="mt-6">
        <Pagination page={result.page} pages={result.pages} href={(p) => href({ page: p > 1 ? String(p) : undefined })} label="Pagination des commandes" />
      </div>
    </>
  );
}
