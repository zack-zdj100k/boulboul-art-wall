import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/account/auth-shell";
import { LoginForm } from "@/components/account/login-form";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default async function LoginPage(props: PageProps<"/account/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  if (await getCurrentUser()) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/account");
  const { t } = await getI18n();
  return (
    <AuthShell title={t("auth.loginTitle")} intro={t("auth.loginIntro")}>
      <LoginForm next={next} />
    </AuthShell>
  );
}
