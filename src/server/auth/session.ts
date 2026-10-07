import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { isProd } from "@/server/env";

export const SESSION_COOKIE = "baw_session";
const SESSION_DAYS = 30;
const RENEW_WHEN_DAYS_LEFT = 15;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: "CUSTOMER" | "ADMIN";
};

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({
    data: { id: hashToken(token), userId, expiresAt, userAgent: userAgent?.slice(0, 255) ?? null },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}

/** Resolve the signed-in user from the session cookie (memoised per request). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { select: { id: true, email: true, fullName: true, role: true, isActive: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Sliding expiration (DB only — cookies cannot be written while rendering a page).
  if (session.expiresAt.getTime() - Date.now() < RENEW_WHEN_DAYS_LEFT * 86_400_000) {
    await prisma.session
      .update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) } })
      .catch(() => {});
  }

  const { id, email, fullName, role } = session.user;
  return { id, email, fullName, role };
});

export async function destroyAllSessionsFor(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}
