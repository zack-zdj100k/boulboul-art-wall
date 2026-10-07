import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/backend/db";
import { isProd } from "@/backend/env";
import { classifyTraffic, deviceOf, slugify } from "@/shared/lib/traffic";

// Traffic analytics (Admin → Réseaux sociaux). First-party only: a random visitor id and the
// last non-direct source are kept in cookies; no IP address or personal data is stored.

const VISITOR_COOKIE = "baw_vid";
const SOURCE_COOKIE = "baw_src";
const ATTRIBUTION_DAYS = 30; // an order placed within 30 days is credited to the source
const RETENTION_DAYS = 400;

export type Attribution = { source: string; campaign: string | null };

export async function recordVisit(input: { url: string; referrer: string | null; userAgent: string | null; ownHost: string }) {
  const traffic = classifyTraffic(input);
  const store = await cookies();
  const cookie = { httpOnly: true, secure: isProd, sameSite: "lax" as const, path: "/" };

  let visitorId = store.get(VISITOR_COOKIE)?.value;
  if (!visitorId || !/^[A-Za-z0-9_-]{16,40}$/.test(visitorId)) {
    visitorId = randomBytes(16).toString("base64url");
    store.set(VISITOR_COOKIE, visitorId, { ...cookie, maxAge: 365 * 86_400 });
  }

  // Last non-direct source wins; a direct visit keeps the previous one (classic "last click").
  if (traffic.source !== "direct" || !store.get(SOURCE_COOKIE)) {
    store.set(SOURCE_COOKIE, JSON.stringify({ s: traffic.source, c: traffic.campaign }), { ...cookie, maxAge: ATTRIBUTION_DAYS * 86_400 });
  }

  await prisma.visit.create({
    data: { visitorId, ...traffic, device: deviceOf(input.userAgent) },
  });

  // Occasional clean-up instead of a cron job.
  if (Math.random() < 0.002) {
    await prisma.visit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86_400_000) } } }).catch(() => {});
  }
}

/** Source credited to an order or a new account (from the attribution cookie). */
export async function readAttribution(): Promise<Attribution | null> {
  const raw = (await cookies()).get(SOURCE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { s?: unknown; c?: unknown };
    const source = typeof v.s === "string" ? slugify(v.s, 40) : null;
    if (!source) return null;
    return { source, campaign: typeof v.c === "string" ? slugify(v.c) : null };
  } catch {
    return null;
  }
}

// ───────────────────────── Report

export type SourceRow = {
  source: string;
  visits: number;
  visitors: number;
  signups: number;
  orders: number;
  ordersValue: number; // orders not cancelled
  delivered: number;
  revenue: number; // delivered orders
};

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

export async function getTrafficReport(days: number) {
  const from = new Date(Date.now() - days * 86_400_000);
  const real = { isDemo: false };

  const [visits, totals, signups, orders, delivered, daily, campaigns, campaignOrders, pages, devices, declared] = await Promise.all([
    prisma.$queryRaw<{ source: string; visits: bigint; visitors: bigint }[]>`
      SELECT "source", COUNT(*) AS visits, COUNT(DISTINCT "visitorId") AS visitors
      FROM "Visit" WHERE "createdAt" >= ${from} GROUP BY "source"`,
    prisma.$queryRaw<{ visits: bigint; visitors: bigint }[]>`
      SELECT COUNT(*) AS visits, COUNT(DISTINCT "visitorId") AS visitors FROM "Visit" WHERE "createdAt" >= ${from}`,
    prisma.user.groupBy({ by: ["signupSource"], where: { ...real, role: "CUSTOMER", createdAt: { gte: from } }, _count: true }),
    prisma.order.groupBy({ by: ["trafficSource"], where: { ...real, createdAt: { gte: from }, status: { not: "CANCELLED" } }, _count: true, _sum: { total: true } }),
    prisma.order.groupBy({ by: ["trafficSource"], where: { ...real, createdAt: { gte: from }, status: "DELIVERED" }, _count: true, _sum: { total: true } }),
    prisma.$queryRaw<{ day: Date; source: string; visits: bigint }[]>`
      SELECT (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Algiers')::date AS day, "source", COUNT(*) AS visits
      FROM "Visit" WHERE "createdAt" >= ${from} GROUP BY 1, 2 ORDER BY 1`,
    prisma.$queryRaw<{ source: string; medium: string | null; campaign: string; visits: bigint; visitors: bigint }[]>`
      SELECT "source", MAX("medium") AS medium, "campaign", COUNT(*) AS visits, COUNT(DISTINCT "visitorId") AS visitors
      FROM "Visit" WHERE "createdAt" >= ${from} AND "campaign" IS NOT NULL
      GROUP BY "source", "campaign" ORDER BY visits DESC LIMIT 20`,
    prisma.order.groupBy({ by: ["trafficSource", "trafficCampaign"], where: { ...real, createdAt: { gte: from }, status: { not: "CANCELLED" }, trafficCampaign: { not: null } }, _count: true, _sum: { total: true } }),
    prisma.$queryRaw<{ path: string; visits: bigint }[]>`
      SELECT "landingPath" AS path, COUNT(*) AS visits FROM "Visit" WHERE "createdAt" >= ${from}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
    prisma.$queryRaw<{ device: string; visits: bigint }[]>`
      SELECT "device", COUNT(*) AS visits FROM "Visit" WHERE "createdAt" >= ${from} GROUP BY 1 ORDER BY 2 DESC`,
    // All customers since the start (answers given before tracking existed are useful too).
    prisma.user.groupBy({ by: ["referralSource"], where: { ...real, role: "CUSTOMER", referralSource: { not: null } }, _count: true }),
  ]);

  const rows = new Map<string, SourceRow>();
  const row = (source: string | null) => {
    const key = source ?? "unknown";
    let r = rows.get(key);
    if (!r) rows.set(key, (r = { source: key, visits: 0, visitors: 0, signups: 0, orders: 0, ordersValue: 0, delivered: 0, revenue: 0 }));
    return r;
  };
  for (const v of visits) Object.assign(row(v.source), { visits: n(v.visits), visitors: n(v.visitors) });
  for (const s of signups) row(s.signupSource).signups = s._count;
  for (const o of orders) Object.assign(row(o.trafficSource), { orders: o._count, ordersValue: n(o._sum.total) });
  for (const o of delivered) Object.assign(row(o.trafficSource), { delivered: o._count, revenue: n(o._sum.total) });

  const sources = [...rows.values()].sort((a, b) => b.visits - a.visits || b.orders - a.orders);
  const sum = (k: keyof Omit<SourceRow, "source">) => sources.reduce((t, r) => t + r[k], 0);

  // Daily series: one column per day of the period, even without visits.
  const days_: string[] = [];
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers" });
  for (let i = days - 1; i >= 0; i--) days_.push(fmt.format(new Date(Date.now() - i * 86_400_000)));
  const perDay = new Map<string, Record<string, number>>(days_.map((d) => [d, {}]));
  for (const d of daily) {
    const key = d.day.toISOString().slice(0, 10);
    const bucket = perDay.get(key);
    if (bucket) bucket[d.source] = (bucket[d.source] ?? 0) + n(d.visits);
  }

  const orderByCampaign = new Map(campaignOrders.map((o) => [`${o.trafficSource}|${o.trafficCampaign}`, o]));

  return {
    days,
    totals: {
      visits: n(totals[0]?.visits),
      visitors: n(totals[0]?.visitors),
      signups: sum("signups"),
      orders: sum("orders"),
      // Orders whose source is known (placed since tracking started) — used for the conversion rate.
      measuredOrders: sources.filter((r) => r.source !== "unknown").reduce((t, r) => t + r.orders, 0),
      ordersValue: sum("ordersValue"),
      delivered: sum("delivered"),
      revenue: sum("revenue"),
    },
    sources,
    daily: days_.map((day) => ({ day, bySource: perDay.get(day)! })),
    campaigns: campaigns.map((c) => {
      const o = orderByCampaign.get(`${c.source}|${c.campaign}`);
      return { source: c.source, medium: c.medium, campaign: c.campaign, visits: n(c.visits), visitors: n(c.visitors), orders: o?._count ?? 0, ordersValue: n(o?._sum.total) };
    }),
    pages: pages.map((p) => ({ path: p.path, visits: n(p.visits) })),
    devices: devices.map((d) => ({ device: d.device, visits: n(d.visits) })),
    declared: declared.map((d) => ({ source: d.referralSource!, count: d._count })).sort((a, b) => b.count - a.count),
  };
}

export type TrafficReport = Awaited<ReturnType<typeof getTrafficReport>>;
