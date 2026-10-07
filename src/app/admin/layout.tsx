import type { Metadata } from "next";
import { AdminNav } from "@/frontend/components/admin/admin-nav";
import { AdminShell } from "@/frontend/components/admin/admin-shell";
import { requireAdmin } from "@/backend/auth/guards";
import { prisma } from "@/backend/db";

export const metadata: Metadata = { title: { default: "Administration", template: "%s · Admin Boulboul" }, robots: { index: false, follow: false } };

// Admin UI is in French (internal tool for the Boulboul team). Access is enforced
// server-side here AND in every /api/admin route.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const [pendingOrders, pendingCustom, pendingReviews, newReturns] = await Promise.all([
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.customOrder.count({ where: { status: "PENDING" } }),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.returnRequest.count({ where: { status: "REQUESTED" } }),
  ]);
  return (
    <AdminShell
      nav={
        <AdminNav
          user={{ fullName: user.fullName, email: user.email }}
          // Custom requests are orders too: count them on "Commandes" as well.
          badges={{ orders: pendingOrders + pendingCustom, custom: pendingCustom, reviews: pendingReviews, returns: newReturns }}
        />
      }
    >
      {children}
    </AdminShell>
  );
}
