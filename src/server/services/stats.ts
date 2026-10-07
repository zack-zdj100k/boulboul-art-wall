import "server-only";
import { prisma } from "@/server/db";

// Dashboard statistics — computed live from PostgreSQL, never estimated.
//
// Chiffre d'affaires = an order counts only once it is DELIVERED (its final total: after promotion,
// negotiation, with delivery) − returns (the returned pieces' share of the products price, once
// the piece is back) ± exchanges (price difference of the new piece, once the exchange is done).

type ReturnForStats = {
  type: "RETURN" | "EXCHANGE";
  status: string;
  quantity: number;
  replacementPrice: number | null;
  orderItem: { unitPrice: number } | null;
  order: { subtotal: number; negotiatedDiscount: number };
};

/** Amount refunded for a return: the pieces' price, minus their share of the negotiated discount. */
export function returnRefund(r: ReturnForStats) {
  if (!r.orderItem || r.order.subtotal <= 0) return 0;
  const gross = r.orderItem.unitPrice * r.quantity;
  return Math.round((gross * (r.order.subtotal - r.order.negotiatedDiscount)) / r.order.subtotal);
}

/** Difference paid (+) or given back (−) for a completed exchange. */
export function exchangeDifference(r: ReturnForStats) {
  if (!r.orderItem || r.replacementPrice == null) return 0;
  return (r.replacementPrice - r.orderItem.unitPrice) * r.quantity;
}

export function computeRevenue(deliveredTotal: number, requests: ReturnForStats[]) {
  const refunds = requests.filter((r) => r.type === "RETURN" && (r.status === "RETURN_RECEIVED" || r.status === "COMPLETED")).reduce((n, r) => n + returnRefund(r), 0);
  const exchanges = requests.filter((r) => r.type === "EXCHANGE" && r.status === "COMPLETED").reduce((n, r) => n + exchangeDifference(r), 0);
  return { delivered: deliveredTotal, refunds, exchanges, revenue: deliveredTotal - refunds + exchanges };
}

export async function getDashboardStats() {
  const [byStatus, revenue, customers, customByStatus, recentOrders, bestSellers, pendingReviews, failedEmails, openReturns, unpricedProducts, requests, toCollect] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], _count: true }),
    prisma.order.aggregate({ where: { status: "DELIVERED" }, _sum: { total: true } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.customOrder.groupBy({ by: ["status"], _count: true }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, orderNumber: true, customerName: true, total: true, status: true, createdAt: true, wilayaName: true, isDemo: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId", "productName"],
      where: { order: { status: "DELIVERED" } },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.emailLog.count({ where: { status: "FAILED", createdAt: { gt: new Date(Date.now() - 7 * 86_400_000) } } }),
    prisma.returnRequest.count({ where: { status: { in: ["REQUESTED", "UNDER_REVIEW", "APPROVED", "RETURN_RECEIVED", "EXCHANGE_PROCESSING"] } } }),
    // Active products that cannot be bought because no price is configured.
    prisma.product.count({
      where: {
        status: "ACTIVE",
        archivedAt: null,
        measures: { none: { isActive: true, price: { gt: 0 } } },
        // Sur Mesure counts as priced only when fully configured.
        OR: [{ allowCustomSize: false }, { refPrice: null }, { refWidthCm: null }, { refHeightCm: null }, { widthStepPrice: null }, { heightStepPrice: null }],
      },
    }),
    prisma.returnRequest.findMany({
      where: { order: { status: "DELIVERED" } },
      select: { type: true, status: true, quantity: true, replacementPrice: true, orderItem: { select: { unitPrice: true } }, order: { select: { subtotal: true, negotiatedDiscount: true } } },
    }),
    // Confirmed but not delivered yet: not revenue, shown as "to collect".
    prisma.order.aggregate({ where: { status: { in: ["CONFIRMED", "CONTACTING", "PENDING"] } }, _sum: { total: true } }),
  ]);
  const money = computeRevenue(revenue._sum?.total ?? 0, requests);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const totalOrders = byStatus.reduce((s, b) => s + b._count, 0);
  return {
    totalOrders,
    pending: count("PENDING"),
    confirmed: count("CONFIRMED"),
    contacting: count("CONTACTING"),
    delivered: count("DELIVERED"),
    cancelled: count("CANCELLED"),
    revenue: money.revenue,
    revenueDelivered: money.delivered,
    revenueRefunds: money.refunds,
    revenueExchanges: money.exchanges,
    toCollect: toCollect._sum?.total ?? 0,
    returnsDone: requests.filter((r) => r.type === "RETURN" && (r.status === "RETURN_RECEIVED" || r.status === "COMPLETED")).length,
    exchangesDone: requests.filter((r) => r.type === "EXCHANGE" && r.status === "COMPLETED").length,
    customers,
    customRequests: customByStatus.reduce((s, b) => s + b._count, 0),
    customPending: customByStatus.filter((b) => ["PENDING", "REVIEWING"].includes(b.status)).reduce((s, b) => s + b._count, 0),
    recentOrders,
    bestSellers: bestSellers.map((b) => ({ productId: b.productId, name: b.productName, quantity: b._sum?.quantity ?? 0, revenue: b._sum?.totalPrice ?? 0 })),
    pendingReviews,
    failedEmails,
    openReturns,
    unpricedProducts,
  };
}

export async function hasDemoData() {
  const [products, orders] = await Promise.all([prisma.product.count({ where: { isDemo: true } }), prisma.order.count({ where: { isDemo: true } })]);
  return products + orders > 0;
}
