import Link from "next/link";
import { z } from "zod";
import { CustomerActions } from "@/frontend/components/admin/customer-actions";
import { Empty, PageHeader, Table } from "@/frontend/components/admin/ui";
import { Badge } from "@/frontend/components/ui/badge";
import { Pagination } from "@/frontend/components/ui/pagination";
import { formatDate } from "@/shared/i18n/config";
import { cn } from "@/shared/lib/utils";
import { requireAdmin } from "@/backend/auth/guards";
import { listCustomers } from "@/backend/services/admin-queries";

export const metadata = { title: "Clients" };

const REF: Record<string, string> = { TIKTOK: "TikTok", INSTAGRAM: "Instagram", FACEBOOK: "Facebook", OTHER: "Autre" };

export default async function AdminCustomers(props: PageProps<"/admin/customers">) {
  const sp = await props.searchParams;
  const q = z.string().max(100).optional().catch(undefined).parse(sp.q);
  const page = z.coerce.number().int().min(1).optional().catch(undefined).parse(sp.page);
  const role = z.enum(["CUSTOMER", "ADMIN"]).optional().catch(undefined).parse(sp.role);
  const [result, me] = await Promise.all([listCustomers({ q, page, role }), requireAdmin()]);
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ q, role, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/customers${p.size ? `?${p}` : ""}`;
  };
  return (
    <>
      <PageHeader title="Clients" description={`${result.total} compte(s). Modifiez, rendez administrateur, désactivez ou supprimez un compte depuis le menu « … ». Les données personnelles ne sont visibles que par les administrateurs.`} />
      <ul className="mb-4 flex gap-2" aria-label="Type de compte">
        {[[undefined, "Tous"], ["CUSTOMER", "Clients"], ["ADMIN", "Administrateurs"]].map(([value, label]) => (
          <li key={label}>
            <Link href={href({ role: value, page: undefined })} aria-current={role === value ? "page" : undefined} className={cn("block rounded-full border px-4 py-1.5 text-xs font-semibold", role === value ? "border-ivory bg-ivory text-ink" : "border-line text-sand hover:text-ivory")}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <form method="get" className="mb-6 flex gap-2">
        {role && <input type="hidden" name="role" value={role} />}
        <input name="q" defaultValue={q} placeholder="Nom, e-mail ou téléphone…" aria-label="Rechercher un client" className="h-11 flex-1 rounded-field border border-line-strong bg-umber-900 px-4 text-sm focus:border-gold focus:outline-none" />
        <button className="h-11 rounded-full bg-ivory px-5 text-sm font-bold text-ink">Rechercher</button>
      </form>
      {result.customers.length ? (
        <Table>
          <thead>
            <tr><th>Nom</th><th>E-mail</th><th>Téléphone</th><th className="hidden 2xl:table-cell">Âge</th><th className="hidden 2xl:table-cell">Découverte</th><th>Commandes</th><th className="hidden 2xl:table-cell">Sur mesure</th><th className="hidden whitespace-nowrap xl:table-cell">Inscrit le</th><th><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {result.customers.map((c) => (
              <tr key={c.id}>
                <td className="font-semibold">
                  {c.fullName} {c.role === "ADMIN" && <Badge tone="gold">Admin</Badge>} {!c.isActive && <Badge tone="ember">Désactivé</Badge>} {c.isDemo && <Badge tone="demo">Démo</Badge>}
                  {c.id === me.id && <span className="block text-xs font-normal text-stone">Vous</span>}
                </td>
                <td><a href={`mailto:${c.email}`} className="text-gold hover:underline">{c.email}</a></td>
                <td className="tabular-nums">{c.phone ?? "—"}</td>
                <td className="hidden tabular-nums 2xl:table-cell">{c.age ?? "—"}</td>
                <td className="hidden 2xl:table-cell">{c.referralSource ? REF[c.referralSource] : "—"}{c.referralOther ? ` (${c.referralOther})` : ""}</td>
                <td className="tabular-nums">{c._count.orders}</td>
                <td className="hidden tabular-nums 2xl:table-cell">{c._count.customOrders}</td>
                <td className="hidden whitespace-nowrap text-stone xl:table-cell">{formatDate(c.createdAt, "fr")}</td>
                <td className="w-px">
                  <CustomerActions isSelf={c.id === me.id} c={{ id: c.id, fullName: c.fullName, email: c.email, phone: c.phone, age: c.age, role: c.role, isActive: c.isActive, orders: c._count.orders }} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>Aucun client.</Empty>
      )}
      <div className="mt-6">
        <Pagination page={result.page} pages={result.pages} href={(p) => href({ page: String(p) })} label="Pagination clients" />
      </div>
    </>
  );
}
