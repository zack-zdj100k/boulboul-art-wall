import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { CMS_PUBLIC_PATHS } from "@/shared/lib/cms-schema";
import { PageHeader } from "@/frontend/components/admin/ui";
import { Badge } from "@/frontend/components/ui/badge";
import { formatDate } from "@/shared/i18n/config";
import { listSections } from "@/backend/services/cms";

export const metadata = { title: "Contenu (CMS)" };

export default async function AdminCms() {
  const sections = await listSections();
  const groups = [...new Set(sections.map((s) => s.group))];
  return (
    <>
      <PageHeader title="Contenu du site" description="Modifiez les textes, images, fondateurs, coordonnées et mentions légales. Les brouillons ne sont visibles qu'après publication. Un contenu vide n'est pas affiché sur le site." />
      <div className="flex flex-col gap-8">
        {groups.map((g) => (
          <section key={g}>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-stone">{g}</h2>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sections.filter((s) => s.group === g).map((s) => (
                <li key={s.key} className="relative flex h-full flex-col gap-2 rounded-panel border border-line bg-ink/60 p-5 transition focus-within:border-ivory/30 hover:border-ivory/30">
                  <span className="flex items-center justify-between gap-2">
                    {/* The whole card opens the editor (stretched link); the icons stay clickable on top. */}
                    <Link href={`/admin/cms/${encodeURIComponent(s.key)}`} className="font-semibold after:absolute after:inset-0 after:rounded-panel">
                      {s.title}
                    </Link>
                    {s.hasUnpublished ? <Badge tone="gold">Brouillon</Badge> : s.publishedAt ? <Badge tone="sage">Publié</Badge> : <Badge>Vide</Badge>}
                  </span>
                  <span className="text-sm text-sand">{s.description}</span>
                  <span className="mt-auto flex items-center justify-between gap-3 pt-1">
                    <span className="text-xs text-stone">{s.updatedAt ? `Modifié le ${formatDate(s.updatedAt, "fr", true)}` : ""}</span>
                    <span className="relative z-10 flex gap-1">
                      <Link href={`/admin/cms/${encodeURIComponent(s.key)}`} aria-label={`Modifier « ${s.title} »`} title="Modifier" className="grid size-8 place-items-center rounded-full text-sand hover:bg-ivory/8 hover:text-ivory">
                        <Pencil className="size-3.5" />
                      </Link>
                      {CMS_PUBLIC_PATHS[s.key] && (
                        <a href={CMS_PUBLIC_PATHS[s.key]} target="_blank" rel="noreferrer" aria-label={`Voir « ${s.title} » sur le site`} title="Voir sur le site" className="grid size-8 place-items-center rounded-full text-sand hover:bg-ivory/8 hover:text-ivory">
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
