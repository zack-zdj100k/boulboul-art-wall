import Image from "next/image";
import Link from "next/link";
import { z } from "zod";
import { DeleteOrderButton } from "@/frontend/components/admin/delete-order-button";
import { CUSTOM_STATUS_FR, Empty, PageHeader, StatusBadge, Table } from "@/frontend/components/admin/ui";
import { Pagination } from "@/frontend/components/ui/pagination";
import { formatDate, formatPrice } from "@/shared/i18n/config";
import { cn } from "@/shared/lib/utils";
import { listCustomOrders } from "@/backend/services/admin-queries";

export const metadata = { title: "Demandes sur mesure" };

const schema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  status: z.enum(["PENDING", "REVIEWING", "CONTACTED", "APPROVED", "REJECTED", "DELIVERED", "COMPLETED"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});

export default async function AdminCustomOrders(props: PageProps<"/admin/custom-orders">) {
  const sp = await props.searchParams;
  const query = schema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const result = await listCustomOrders(query);
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ q: query.q, status: query.status, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/custom-orders${p.size ? `?${p}` : ""}`;
  };
  return (
    <>
      <PageHeader title="Demandes sur mesure" description="Designs et idées envoyés depuis la page Personnalisation. Aucun e-mail automatique : contactez le client directement." />
      <ul className="scrollbar-none mb-6 flex gap-2 overflow-x-auto">
        {[undefined, ...Object.keys(CUSTOM_STATUS_FR)].map((s) => (
          <li key={s ?? "all"}>
            <Link href={href({ status: s, page: undefined })} className={cn("block whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-semibold", query.status === s ? "border-ivory bg-ivory text-ink" : "border-line text-sand hover:text-ivory")}>
              {s ? CUSTOM_STATUS_FR[s] : "Toutes"}
            </Link>
          </li>
        ))}
      </ul>
      {result.requests.length ? (
        <Table>
          <thead>
            <tr><th>Design</th><th>Référence</th><th>Client</th><th>Téléphone</th><th>Dimensions</th><th>Devis</th><th>Statut</th><th>Reçue le</th><th><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {result.requests.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.designUrl ? (
                    <span className="relative block size-12 overflow-hidden rounded-art bg-umber-800">
                      {/* Private media: served through the authorised /media route, not the optimiser. */}
                      <Image src={r.designUrl} alt="" fill sizes="48px" unoptimized className="object-cover" />
                    </span>
                  ) : (
                    <span className="text-xs text-stone">—</span>
                  )}
                </td>
                <td><Link href={`/admin/custom-orders/${r.id}`} className="font-semibold text-gold hover:underline tabular-nums">{r.reference}</Link></td>
                <td>{r.customerName}</td>
                <td className="tabular-nums">{r.phone}</td>
                <td className="tabular-nums">{r.widthCm && r.heightCm ? `${r.widthCm} × ${r.heightCm} cm` : "—"}</td>
                <td className="tabular-nums">{r.total != null ? formatPrice(r.total, "fr") : <span className="text-stone">À chiffrer</span>}</td>
                <td><StatusBadge status={r.status} labels={CUSTOM_STATUS_FR} /></td>
                <td className="text-stone">{formatDate(r.createdAt, "fr", true)}</td>
                <td><DeleteOrderButton kind="CUSTOM" id={r.id} number={r.reference} compact /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>Aucune demande.</Empty>
      )}
      <div className="mt-6"><Pagination page={result.page} pages={result.pages} href={(p) => href({ page: String(p) })} label="Pagination" /></div>
    </>
  );
}
