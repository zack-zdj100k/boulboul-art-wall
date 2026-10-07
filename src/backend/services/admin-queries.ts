import "server-only";
import type { CustomOrderStatus, OrderStatus, Prisma, ReviewStatus } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/db";
import { mediaUrl } from "@/backend/storage";

const PAGE = 25;

export async function searchOrders(query: { q?: string; status?: OrderStatus; page?: number }) {
  const q = query.q?.trim();
  const where: Prisma.OrderWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" } },
            { customerName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q.replace(/\s/g, "") } },
            { wilayaName: { contains: q, mode: "insensitive" } },
            { commune: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const page = Math.max(1, query.page ?? 1);
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true, orderNumber: true, customerName: true, phone: true, wilayaName: true, total: true, status: true, createdAt: true, isDemo: true,
        items: { select: { productName: true, quantity: true } },
        emails: { where: { status: "FAILED" }, select: { id: true }, take: 1 },
      },
    }),
    prisma.order.count({ where }),
  ]);
  return { orders, total, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
}

export async function listCustomers(query: { q?: string; page?: number; role?: "CUSTOMER" | "ADMIN" }) {
  const q = query.q?.trim();
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
  };
  const page = Math.max(1, query.page ?? 1);
  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true, fullName: true, email: true, phone: true, age: true, referralSource: true, referralOther: true, createdAt: true, lastLoginAt: true, isDemo: true, role: true, isActive: true,
        _count: { select: { orders: true, customOrders: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { customers, total, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
}

export async function listCustomOrders(query: { status?: CustomOrderStatus; q?: string; page?: number }) {
  const q = query.q?.trim();
  const where: Prisma.CustomOrderWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(q ? { OR: [{ reference: { contains: q, mode: "insensitive" } }, { customerName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
  };
  const page = Math.max(1, query.page ?? 1);
  const [rows, total] = await Promise.all([
    prisma.customOrder.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { designMedia: true } }),
    prisma.customOrder.count({ where }),
  ]);
  return {
    requests: rows.map((r) => ({ ...r, designUrl: r.designMedia ? mediaUrl(r.designMedia.key) : null })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE)),
  };
}

export async function listReviews(query: { status?: ReviewStatus; page?: number }) {
  const where: Prisma.ReviewWhereInput = query.status ? { status: query.status } : {};
  const page = Math.max(1, query.page ?? 1);
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { product: { select: { name: true, slug: true } }, user: { select: { email: true } } },
    }),
    prisma.review.count({ where }),
  ]);
  return { reviews, total, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
}

export async function listMedia(query: { page?: number; visibility?: "PUBLIC" | "PRIVATE" }) {
  const where: Prisma.MediaWhereInput = { visibility: query.visibility ?? "PUBLIC" };
  const page = Math.max(1, query.page ?? 1);
  const take = 48;
  const [rows, total] = await Promise.all([
    prisma.media.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      include: { _count: { select: { productImages: true, categories: true, frames: true, customOrders: true } } },
    }),
    prisma.media.count({ where }),
  ]);
  return {
    media: rows.map((m) => ({
      id: m.id,
      url: mediaUrl(m.key),
      key: m.key,
      alt: m.alt,
      originalName: m.originalName,
      mime: m.mime,
      size: m.size,
      width: m.width,
      height: m.height,
      createdAt: m.createdAt,
      usage: m._count.productImages + m._count.categories + m._count.frames + m._count.customOrders,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / take)),
  };
}

// ───────── Unified "Commandes" list: catalogue orders + custom design requests

export type OrderRow = {
  kind: "ORDER" | "CUSTOM";
  id: string;
  href: string;
  number: string;
  customerName: string;
  phone: string;
  place: string | null;
  summary: string;
  total: number | null;
  status: string;
  createdAt: Date;
  isDemo: boolean;
  emailFailed: boolean;
};

const UNIFIED_PAGE = 25;
const UNIFIED_CAP = 1000; // per type; plenty for a boutique back-office

export async function searchAllOrders(query: { q?: string; type?: "ORDER" | "CUSTOM"; status?: string; page?: number }) {
  const q = query.q?.trim();
  const orderStatus = ["PENDING", "CONTACTING", "CONFIRMED", "DELIVERED", "CANCELLED"].includes(query.status ?? "") ? (query.status as OrderStatus) : undefined;
  const customStatus = ["PENDING", "REVIEWING", "CONTACTED", "APPROVED", "REJECTED", "DELIVERED", "COMPLETED"].includes(query.status ?? "") ? (query.status as CustomOrderStatus) : undefined;

  const [orders, customs] = await Promise.all([
    query.type === "CUSTOM"
      ? []
      : prisma.order.findMany({
          where: {
            ...(query.type === "ORDER" && orderStatus ? { status: orderStatus } : {}),
            ...(q
              ? {
                  OR: [
                    { orderNumber: { contains: q, mode: "insensitive" } },
                    { customerName: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                    { phone: { contains: q.replace(/\s/g, "") } },
                    { wilayaName: { contains: q, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          take: UNIFIED_CAP,
          select: {
            id: true, orderNumber: true, customerName: true, phone: true, wilayaName: true, total: true, status: true, createdAt: true, isDemo: true,
            items: { select: { productName: true, quantity: true } },
            emails: { where: { status: "FAILED" }, select: { id: true }, take: 1 },
          },
        }),
    query.type === "ORDER"
      ? []
      : prisma.customOrder.findMany({
          where: {
            ...(query.type === "CUSTOM" && customStatus ? { status: customStatus } : {}),
            ...(q
              ? {
                  OR: [
                    { reference: { contains: q, mode: "insensitive" } },
                    { customerName: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                    { phone: { contains: q } },
                  ],
                }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          take: UNIFIED_CAP,
          select: { id: true, reference: true, customerName: true, phone: true, wilayaName: true, total: true, status: true, createdAt: true, description: true, widthCm: true, heightCm: true },
        }),
  ]);

  const rows: OrderRow[] = [
    ...orders.map((o) => ({
      kind: "ORDER" as const,
      id: o.id,
      href: `/admin/orders/${o.id}`,
      number: o.orderNumber,
      customerName: o.customerName,
      phone: o.phone,
      place: o.wilayaName,
      summary: o.items.map((i) => `${i.productName} ×${i.quantity}`).join(", "),
      total: o.total,
      status: o.status,
      createdAt: o.createdAt,
      isDemo: o.isDemo,
      emailFailed: o.emails.length > 0,
    })),
    ...customs.map((c) => ({
      kind: "CUSTOM" as const,
      id: c.id,
      href: `/admin/custom-orders/${c.id}`,
      number: c.reference,
      customerName: c.customerName,
      phone: c.phone,
      place: c.wilayaName,
      summary: [c.widthCm && c.heightCm ? `${c.widthCm} × ${c.heightCm} cm` : null, c.description].filter(Boolean).join(" — "),
      total: c.total,
      status: c.status,
      createdAt: c.createdAt,
      isDemo: false,
      emailFailed: false,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / UNIFIED_PAGE));
  const page = Math.min(pages, Math.max(1, query.page ?? 1));
  return { rows: rows.slice((page - 1) * UNIFIED_PAGE, page * UNIFIED_PAGE), total, page, pages };
}
