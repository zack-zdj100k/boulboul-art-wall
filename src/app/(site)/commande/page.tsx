import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("cart.title"), robots: { index: false, follow: false } };
}

export default async function CartPage() {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  const profile = user ? await prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true, email: true, phone: true } }) : null;
  return (
    <div className="container-page flex flex-col gap-10 pt-32 pb-28 md:pt-40">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-title font-light">{t("cart.title")}</h1>
        <p className="max-w-2xl text-sand">{t("cart.intro")}</p>
      </header>
      <CartView customer={profile ? { customerName: profile.fullName, email: profile.email, phone: profile.phone ?? "" } : null} />
    </div>
  );
}
