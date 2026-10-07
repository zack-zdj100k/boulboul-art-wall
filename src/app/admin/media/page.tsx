import Link from "next/link";
import { z } from "zod";
import { MediaLibrary } from "@/components/admin/media-library";
import { Empty, PageHeader } from "@/components/admin/ui";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { listMedia } from "@/server/services/admin-queries";

export const metadata = { title: "Médias" };

export default async function AdminMedia(props: PageProps<"/admin/media">) {
  const sp = await props.searchParams;
  const visibility = sp.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC";
  const page = z.coerce.number().int().min(1).optional().catch(undefined).parse(sp.page);
  const result = await listMedia({ visibility, page });
  return (
    <>
      <PageHeader title="Médias" description="Images des produits, des catégories et du CMS. Une image utilisée ne peut pas être supprimée." />
      <div className="mb-6 flex gap-2">
        {(["PUBLIC", "PRIVATE"] as const).map((v) => (
          <Link key={v} href={v === "PUBLIC" ? "/admin/media" : "/admin/media?visibility=PRIVATE"} className={cn("rounded-full border px-4 py-1.5 text-xs font-semibold", visibility === v ? "border-ivory bg-ivory text-ink" : "border-line text-sand")}>
            {v === "PUBLIC" ? "Site public" : "Designs clients (privés)"}
          </Link>
        ))}
      </div>
      {result.media.length || visibility === "PUBLIC" ? <MediaLibrary media={result.media} privateView={visibility === "PRIVATE"} /> : <Empty>Aucun design client.</Empty>}
      <div className="mt-6"><Pagination page={result.page} pages={result.pages} href={(p) => `/admin/media?${new URLSearchParams({ visibility, page: String(p) })}`} label="Pagination" /></div>
    </>
  );
}
