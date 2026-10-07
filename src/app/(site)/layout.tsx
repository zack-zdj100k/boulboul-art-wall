import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth/session";
import { getFooterData } from "@/server/site-data";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [{ locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const footer = await getFooterData(locale);
  return (
    <>
      <SiteHeader user={user ? { fullName: user.fullName, role: user.role } : null} />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter data={footer} />
    </>
  );
}
