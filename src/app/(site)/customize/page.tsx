import type { Metadata } from "next";
import Image from "next/image";
import { CustomDesignForm } from "@/frontend/components/forms/custom-design-form";
import { Reveal } from "@/frontend/components/ui/reveal";
import { pick } from "@/shared/i18n/config";
import { parseColors } from "@/shared/lib/options";
import { getI18n } from "@/shared/i18n/server";
import { getCurrentUser } from "@/backend/auth/session";
import { prisma } from "@/backend/db";
import { getCustomEstimateConfig, getSettings } from "@/backend/services/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("customize.title"), description: t("customize.intro"), alternates: { canonical: "/customize" } };
}

export default async function CustomizePage() {
  const { t, locale } = await getI18n();
  const user = await getCurrentUser();
  const [frames, extras, limits, profile, surMesure] = await Promise.all([
    prisma.frameOption.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.extraOption.findMany({ where: { isActive: true, availableForCustom: true }, orderBy: { sortOrder: "asc" } }),
    getSettings(["custom.minWidthCm", "custom.maxWidthCm", "custom.minHeightCm", "custom.maxHeightCm"]),
    user ? prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true, email: true, phone: true } }) : null,
    getCustomEstimateConfig(),
  ]);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[70vh]">
        <Image src="/brand/products/crown-wings-staged.jpg" alt="" fill preload sizes="100vw" className="object-cover object-[50%_30%] opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/80 to-ink" />
      </div>
      <div className="container-page grid gap-12 pt-36 pb-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 md:pt-44">
        <Reveal className="flex flex-col gap-6 lg:sticky lg:top-32 lg:self-start">
          <p className="eyebrow">{t("home.customEyebrow")}</p>
          <h1 className="font-display text-display font-light tracking-[-0.025em] text-balance">{t("customize.title")}</h1>
          <p className="text-lg leading-relaxed text-sand">{t("customize.intro")}</p>
        </Reveal>
        <div className="rounded-panel border border-line bg-umber-950/85 p-6 shadow-lifted backdrop-blur-xl md:p-10">
          <CustomDesignForm
            frames={frames.map((f) => ({ id: f.id, name: pick(f, "name", locale), swatch: f.swatch, description: f.description, price: f.price }))}
            extras={extras.map((x) => ({
              id: x.id,
              name: pick(x, "name", locale),
              description: x.description,
              price: x.price,
              colors: parseColors(x.colors),
              notePrompt: x.askNote ? pick(x, "notePrompt", locale) || null : null,
            }))}
            limits={{ minW: limits["custom.minWidthCm"], maxW: limits["custom.maxWidthCm"], minH: limits["custom.minHeightCm"], maxH: limits["custom.maxHeightCm"] }}
            surMesure={surMesure}
            prefill={profile ? { customerName: profile.fullName, email: profile.email, phone: profile.phone ?? "" } : null}
          />
        </div>
      </div>
    </div>
  );
}
