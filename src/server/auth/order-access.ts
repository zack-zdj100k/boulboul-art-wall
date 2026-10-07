import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { SessionUser } from "./session";

function sameToken(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** An order is visible to its signed-in owner, an admin, or whoever holds its private token. */
export function canAccessOrder(order: { userId: string | null; publicToken: string }, user: SessionUser | null, token?: string | null, opts: { allowAdmin?: boolean } = {}) {
  if (user && (order.userId === user.id || (opts.allowAdmin && user.role === "ADMIN"))) return true;
  return !!token && sameToken(token, order.publicToken);
}
