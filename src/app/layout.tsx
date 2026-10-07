import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Sans_Arabic, Manrope } from "next/font/google";
import { Providers } from "@/components/site/providers";
import { getI18n } from "@/i18n/server";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz", "SOFT"], display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-plex-arabic", display: "swap" });

const appUrl = process.env.APP_URL ?? "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  return {
    metadataBase: new URL(appUrl),
    title: { default: t("meta.title"), template: "%s · Boulboul Art Wall" },
    description: t("meta.description"),
    applicationName: "Boulboul Art Wall",
    openGraph: {
      type: "website",
      siteName: "Boulboul Art Wall",
      title: t("meta.title"),
      description: t("meta.description"),
      locale: locale === "ar" ? "ar_DZ" : "fr_DZ",
      images: [{ url: "/brand/scenes/wall-dark.jpg", width: 1672, height: 941, alt: "Boulboul Art Wall" }],
    },
    twitter: { card: "summary_large_image", title: t("meta.title"), description: t("meta.description"), images: ["/brand/scenes/wall-dark.jpg"] },
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = { themeColor: "#faf7f0", colorScheme: "light" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir, messages } = await getI18n();
  return (
    <html lang={locale} dir={dir} className={`${fraunces.variable} ${manrope.variable} ${plexArabic.variable}`}>
      <body className="min-h-dvh">
        {/* Without JavaScript, entrance animations never run: show everything immediately. */}
        <noscript>
          <style>{`[style*="opacity:0"],[style*="opacity: 0"]{opacity:1!important;transform:none!important;filter:none!important}`}</style>
        </noscript>
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
