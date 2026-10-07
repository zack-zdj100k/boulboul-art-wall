import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getI18n } from "@/shared/i18n/server";
import { getLegal } from "@/backend/cms-content";

const PAGES = { terms: "legal.terms", privacy: "legal.privacy", returns: "legal.returns" } as const;

export async function generateMetadata(props: PageProps<"/legal/[page]">): Promise<Metadata> {
  const { page } = await props.params;
  if (!(page in PAGES)) return {};
  const { t } = await getI18n();
  return { title: t(`legal.${page}`), alternates: { canonical: `/legal/${page}` } };
}

export default async function LegalPage(props: PageProps<"/legal/[page]">) {
  const { page } = await props.params;
  if (!(page in PAGES)) notFound();
  const { t, locale } = await getI18n();
  const body = await getLegal(PAGES[page as keyof typeof PAGES], locale);
  return (
    <div className="container-page max-w-3xl pt-36 pb-28 md:pt-44">
      <h1 className="mb-12 font-display text-title font-light">{t(`legal.${page}`)}</h1>
      {body ? (
        <div className="flex flex-col gap-5 text-[17px] leading-[1.8] text-sand">
          {body.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="whitespace-pre-line">{p}</p>
          ))}
        </div>
      ) : (
        <p className="text-sand">{t("legal.empty")}</p>
      )}
    </div>
  );
}
