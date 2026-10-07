import { NextResponse } from "next/server";
import { createOrderSchema } from "@/shared/lib/validation";
import { getLocale } from "@/shared/i18n/server";
import { createSession } from "@/backend/auth/session";
import { prisma } from "@/backend/db";
import { AppError, clientIp, parseJson, publicRoute, unauthorized } from "@/backend/http";
import { rateLimit } from "@/backend/rate-limit";
import { createOrder } from "@/backend/services/order";
import { readAttribution } from "@/backend/services/traffic";
import { discardNewAccount, registerUser } from "@/backend/services/user";

/**
 * Every order belongs to a Boulboul account. A signed-in customer just orders; a visitor fills in
 * the delivery details plus a password (and age, how they found us) and the account is created
 * with the order, then signed in.
 */
export const POST = publicRoute(async (req, { user }) => {
  rateLimit(`order:${clientIp(req)}`, 10, 10 * 60_000);
  const input = await parseJson(req, createOrderSchema);
  const [locale, attribution] = await Promise.all([getLocale(), readAttribution()]);

  if (user) {
    const { order } = await createOrder(input, { userId: user.id, locale, attribution });
    return placed(order);
  }

  if (!input.account) throw new AppError(422, "validation.invalid", { "account.password": "validation.required" });
  rateLimit(`register:${clientIp(req)}`, 5, 15 * 60_000);
  const c = input.customer;
  const account = await registerUser(
    { fullName: c.customerName, email: c.email, phone: c.phone, ...input.account },
    attribution,
  ).catch((err) => {
    // The e-mail belongs to an existing account: point the field out so the customer signs in.
    if (err instanceof AppError && err.code === "errors.emailTaken") throw new AppError(409, "checkout.emailTaken", { "customer.email": "checkout.emailTaken" });
    throw err;
  });
  try {
    const { order } = await createOrder(input, { userId: account.id, locale, attribution });
    await createSession(account.id, req.headers.get("user-agent"));
    return placed(order);
  } catch (err) {
    await discardNewAccount(account.id); // so the customer can simply try again
    throw err;
  }
});

function placed(order: { orderNumber: string; publicToken: string; status: string; total: number }) {
  // Only what the confirmation page needs; the token lets the customer reopen their own order.
  return NextResponse.json({ orderNumber: order.orderNumber, token: order.publicToken, status: order.status, total: order.total }, { status: 201 });
}

/** The signed-in customer's own orders. */
export const GET = publicRoute(async (_req, { user }) => {
  if (!user) throw unauthorized();
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true, createdAt: true, total: true, status: true, items: { select: { productName: true, quantity: true } } },
  });
  return NextResponse.json({ orders });
});
