import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/frontend/components/account/auth-shell";
import { RegisterForm } from "@/frontend/components/account/register-form";
import { getI18n } from "@/shared/i18n/server";
import { getCurrentUser } from "@/backend/auth/session";

export const metadata: Metadata = { title: "Créer un compte", robots: { index: false } };

export default async function RegisterPage(props: PageProps<"/account/register">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  if (await getCurrentUser()) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/account");
  const { t } = await getI18n();
  return (
    <AuthShell title={t("auth.registerTitle")} intro={t("auth.registerIntro")}>
      <RegisterForm next={next} />
    </AuthShell>
  );
}
