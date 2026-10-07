import "server-only";
import type { EmailType } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import { getEmailSettings } from "@/server/services/settings";
import { getEmailProvider } from "./providers";
import { newOrderAdminEmail } from "./templates/new-order-admin";
import { orderConfirmedCustomerEmail } from "./templates/order-confirmed-customer";
import { orderDeliveredCustomerEmail } from "./templates/order-delivered-customer";
import type { EmailOrder } from "./types";

// EmailService — order notifications (KING 253 style):
//   new order → admin recipients · confirmed → customer · delivered → customer.
// Recipients, sender name and the customer emails are set in Admin → Paramètres → E-mails.
// Sending never throws: a failure is logged (server log + EmailLog row on the admin order page)
// and the order is kept.

export type EmailResult = { ok: boolean; error?: string };

/** "Boulboul Art Wall <no-reply@…>" with the sender name from the settings, if any. */
function fromHeader(fromName: string) {
  if (!fromName) return undefined;
  const address = env.EMAIL_FROM.match(/<([^>]+)>/)?.[1] ?? env.EMAIL_FROM;
  return `${fromName.replace(/[<>"]/g, "")} <${address}>`;
}

async function deliver(type: EmailType, orderId: string, to: string, message: { subject: string; html: string; text: string }, from?: string): Promise<EmailResult> {
  const provider = getEmailProvider();
  try {
    if (!to) throw new Error("Recipient address is not configured");
    const res = await provider.send({ to, ...message, from });
    await prisma.emailLog.create({
      data: { type, orderId, to, subject: message.subject, status: "SENT", provider: provider.name, providerMessageId: res.id ?? null },
    });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("Email delivery failed", { type, orderId, to, error });
    await prisma.emailLog
      .create({ data: { type, orderId, to: to || "(non configuré)", subject: message.subject, status: "FAILED", provider: provider.name, error: error.slice(0, 1000) } })
      .catch((e) => logger.error("Could not record email failure", e));
    return { ok: false, error };
  }
}

/** New order → every admin recipient (Paramètres → E-mails, or ADMIN_EMAIL). */
export async function sendNewOrderAdminEmail(order: EmailOrder): Promise<EmailResult> {
  const settings = await getEmailSettings(env.ADMIN_EMAIL);
  const message = newOrderAdminEmail(order, { adminOrderUrl: `${env.APP_URL}/admin/orders/${order.id}`, appUrl: env.APP_URL });
  const recipients = settings.adminRecipients.length ? settings.adminRecipients : [""];
  const results = [];
  for (const to of recipients) results.push(await deliver("NEW_ORDER_ADMIN", order.id, to, message, fromHeader(settings.fromName)));
  const failed = results.find((r) => !r.ok);
  return failed ?? { ok: true };
}

/** Confirmed → customer (unless turned off in the settings). Null = not sent because disabled. */
export async function sendOrderConfirmedCustomerEmail(order: EmailOrder, opts: { force?: boolean } = {}): Promise<EmailResult | null> {
  const settings = await getEmailSettings(env.ADMIN_EMAIL);
  if (!settings.customerConfirmed && !opts.force) return null;
  return deliver("ORDER_CONFIRMED_CUSTOMER", order.id, order.email, orderConfirmedCustomerEmail(order), fromHeader(settings.fromName));
}

/** Delivered → customer, with a link to their order (returns / exchanges). Null = disabled. */
export async function sendOrderDeliveredCustomerEmail(order: EmailOrder, opts: { force?: boolean } = {}): Promise<EmailResult | null> {
  const settings = await getEmailSettings(env.ADMIN_EMAIL);
  if (!settings.customerDelivered && !opts.force) return null;
  const orderUrl = `${env.APP_URL}/order/${encodeURIComponent(order.orderNumber)}${order.publicToken ? `?token=${encodeURIComponent(order.publicToken)}` : ""}`;
  return deliver("ORDER_DELIVERED_CUSTOMER", order.id, order.email, orderDeliveredCustomerEmail(order, { orderUrl }), fromHeader(settings.fromName));
}

/** Admin "send a test" from the settings page — not tied to an order, not logged. */
export async function sendTestEmail(to: string) {
  const settings = await getEmailSettings(env.ADMIN_EMAIL);
  const provider = getEmailProvider();
  await provider.send({
    to,
    from: fromHeader(settings.fromName),
    subject: "Boulboul Art Wall — e-mail de test",
    text: "Les notifications e-mail de votre boutique fonctionnent.",
    html: `<p style="font-family:Arial,sans-serif;font-size:15px">Les notifications e-mail de votre boutique <strong>Boulboul Art Wall</strong> fonctionnent.</p>`,
  });
  return { provider: provider.name };
}
