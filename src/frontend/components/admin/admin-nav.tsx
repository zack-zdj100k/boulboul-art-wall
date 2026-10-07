"use client";

import { ExternalLink, FileText, RotateCcw, Image as ImageIcon, LayoutDashboard, LogOut, MessageSquare, Package, Palette, Settings, ShoppingBag, Tags, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "@/frontend/components/site/brand";
import { cn } from "@/shared/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Commandes", icon: ShoppingBag, badge: "orders" },
  { href: "/admin/products", label: "Produits", icon: Package },
  { href: "/admin/categories", label: "Catégories", icon: Tags },
  { href: "/admin/custom-orders", label: "Sur mesure", icon: Palette, badge: "custom" },
  { href: "/admin/returns", label: "Retours & échanges", icon: RotateCcw, badge: "returns" },
  { href: "/admin/customers", label: "Clients", icon: Users },
  { href: "/admin/reviews", label: "Avis", icon: MessageSquare, badge: "reviews" },
  { href: "/admin/cms", label: "Contenu (CMS)", icon: FileText },
  { href: "/admin/media", label: "Médias", icon: ImageIcon },
  { href: "/admin/settings", label: "Paramètres", icon: Settings },
] as const;

export function AdminNav({ user, badges }: { user: { fullName: string; email: string }; badges: Record<string, number> }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  return (
    <aside className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur lg:h-dvh lg:border-e lg:border-b-0">
      <div className="flex h-full flex-col gap-4 px-4 py-4 lg:px-5 lg:py-7">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin" className="flex items-center gap-3">
            <BrandMark className="h-8 text-gold" />
            <span className="leading-none">
              <span className="block font-display text-base tracking-[0.14em]">BOULBOUL</span>
              <span className="text-[10px] font-bold tracking-[0.3em] text-stone">ADMIN</span>
            </span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 text-xs font-semibold text-sand hover:text-ivory lg:hidden">
            Site <ExternalLink className="size-3" />
          </Link>
        </div>
        <nav aria-label="Administration" className="scrollbar-none -mx-4 overflow-x-auto px-4 lg:mx-0 lg:mt-6 lg:flex-1 lg:overflow-visible lg:px-0">
          <ul className="flex gap-1 lg:flex-col">
            {ITEMS.map((item) => {
              const count = "badge" in item ? badges[item.badge] : 0;
              const isActive = active(item.href, "exact" in item ? item.exact : false);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 whitespace-nowrap rounded-field px-3 py-2.5 text-[13.5px] font-semibold transition",
                      isActive ? "bg-ivory/10 text-ivory" : "text-sand hover:bg-ivory/5 hover:text-ivory",
                    )}
                  >
                    <item.icon className={cn("size-4", isActive && "text-gold")} aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    {count > 0 && <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-ink tabular-nums">{count}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="hidden flex-col gap-3 border-t border-line pt-4 lg:flex">
          <p className="truncate text-sm font-semibold">{user.fullName}</p>
          <p className="-mt-2 truncate text-xs text-stone">{user.email}</p>
          <div className="flex gap-2">
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-sand hover:text-ivory">
              Voir le site <ExternalLink className="size-3" />
            </Link>
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/");
                router.refresh();
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-sand hover:text-ivory"
            >
              <LogOut className="size-3" /> Sortir
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
