import Link from "next/link";
import { z } from "zod";
import { AddReviewButton, ReviewActions } from "@/frontend/components/admin/review-admin";
import { Empty, PageHeader, REVIEW_STATUS_FR, StatusBadge } from "@/frontend/components/admin/ui";
import { Badge } from "@/frontend/components/ui/badge";
import { Pagination } from "@/frontend/components/ui/pagination";
import { Stars } from "@/frontend/components/ui/stars";
import { formatDate } from "@/shared/i18n/config";
import { cn } from "@/shared/lib/utils";
import { prisma } from "@/backend/db";
import { listReviews } from "@/backend/services/admin-queries";

export const metadata = { title: "Avis" };

export default async function AdminReviews(props: PageProps<"/admin/reviews">) {
  const sp = await props.searchParams;
  const status = z.enum(["PENDING", "APPROVED", "REJECTED", "HIDDEN"]).optional().catch(undefined).parse(sp.status);
  const page = z.coerce.number().int().min(1).optional().catch(undefined).parse(sp.page);
  const [result, products] = await Promise.all([listReviews({ status, page }), prisma.product.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } })]);
  return (
    <>
      <PageHeader title="Avis clients" description="Seuls les avis approuvés sont publics. « Accueil » les affiche dans la section témoignages." actions={<AddReviewButton products={products} />} />
      <ul className="scrollbar-none mb-6 flex gap-2 overflow-x-auto">
        {[undefined, ...Object.keys(REVIEW_STATUS_FR)].map((s) => (
          <li key={s ?? "all"}>
            <Link href={s ? `/admin/reviews?status=${s}` : "/admin/reviews"} className={cn("block whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-semibold", status === s ? "border-ivory bg-ivory text-ink" : "border-line text-sand hover:text-ivory")}>
              {s ? REVIEW_STATUS_FR[s] : "Tous"}
            </Link>
          </li>
        ))}
      </ul>
      {result.reviews.length ? (
        <ul className="flex flex-col gap-3">
          {result.reviews.map((r) => (
            <li key={r.id} className="rounded-panel border border-line bg-ink/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Stars value={r.rating} />
                  <span className="font-semibold">{r.authorName}</span>
                  {r.user && <span className="text-xs text-stone">{r.user.email}</span>}
                  {r.source === "ADMIN" && <Badge tone="outline">Saisi par l&apos;admin</Badge>}
                  {r.verifiedPurchase && <Badge tone="sage">Achat vérifié</Badge>}
                  <StatusBadge status={r.status} labels={REVIEW_STATUS_FR} />
                </div>
                <span className="text-xs text-stone">{formatDate(r.createdAt, "fr", true)}</span>
              </div>
              {r.product && <p className="mt-2 text-xs text-stone">Produit : <Link href={`/wall-art/${r.product.slug}`} className="text-gold hover:underline">{r.product.name}</Link></p>}
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-sand">{r.comment}</p>
              {/(https?:\/\/|www\.)/i.test(r.comment) && <p className="mt-2 text-xs text-ember">⚠ Contient un lien — vérifiez qu&apos;il ne s&apos;agit pas de spam.</p>}
              <div className="mt-4"><ReviewActions id={r.id} status={r.status} isFeatured={r.isFeatured} /></div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Aucun avis{status ? " dans cette catégorie" : ""}. Les avis des clients apparaîtront ici après publication.</Empty>
      )}
      <div className="mt-6"><Pagination page={result.page} pages={result.pages} href={(p) => `/admin/reviews?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) })}`} label="Pagination" /></div>
    </>
  );
}
