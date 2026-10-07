import { SiteFooter } from "@/frontend/components/site/site-footer";
import { SiteHeader } from "@/frontend/components/site/site-header";
import { TrafficTracker } from "@/frontend/components/site/traffic-tracker";
import { getI18n } from "@/shared/i18n/server";
import { getCurrentUser } from "@/backend/auth/session";
import { getFooterData } from "@/backend/site-data";

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
      <TrafficTracker />
    </>
  );
}
