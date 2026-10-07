import { ButtonLink } from "@/frontend/components/ui/button";
import { getI18n } from "@/shared/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="wall-surface grain flex min-h-dvh items-center">
      <div className="container-page flex flex-col items-start gap-6 py-40">
        <p className="eyebrow">404</p>
        <div className="relative">
          <div aria-hidden className="mb-10 aspect-[4/5] w-40 rounded-art border border-dashed border-ivory/25 shadow-mounted" />
        </div>
        <h1 className="font-display text-title font-light">{t("errors.notFoundTitle")}</h1>
        <p className="max-w-md text-lg text-sand">{t("errors.notFoundText")}</p>
        <ButtonLink href="/">{t("errors.backHome")}</ButtonLink>
      </div>
    </div>
  );
}
