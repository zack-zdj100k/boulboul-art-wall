import { notFound } from "next/navigation";
import { CmsEditor } from "@/frontend/components/admin/cms-editor";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/frontend/components/admin/ui";
import { CMS_PUBLIC_PATHS } from "@/shared/lib/cms-schema";
import { getSectionDef } from "@/shared/lib/cms-schema";
import { getSection } from "@/backend/services/cms";

export const metadata = { title: "Modifier le contenu" };

export default async function AdminCmsSection(props: PageProps<"/admin/cms/[key]">) {
  const { key: raw } = await props.params;
  const key = decodeURIComponent(raw);
  if (!getSectionDef(key)) notFound();
  const s = await getSection(key);
  const hasUnpublished = !s.publishedAt || (!!s.updatedAt && s.updatedAt.getTime() - s.publishedAt.getTime() > 1500);
  return (
    <>
      <PageHeader
        back={{ href: "/admin/cms", label: "Contenu" }}
        title={s.def.title}
        description={s.def.description}
        actions={
          CMS_PUBLIC_PATHS[s.def.key] ? (
            <a href={CMS_PUBLIC_PATHS[s.def.key]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:underline">
              Voir sur le site <ExternalLink className="size-3.5" />
            </a>
          ) : undefined
        }
      />
      <CmsEditor def={s.def} initial={s.draft} publishedAt={s.publishedAt?.toISOString() ?? null} hasUnpublished={hasUnpublished} />
    </>
  );
}
