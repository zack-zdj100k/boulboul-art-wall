import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getCurrentUser, type SessionUser } from "@/backend/auth/session";
import { env } from "@/backend/env";
import { logger } from "@/backend/logger";

/**
 * Errors thrown by services. `code` is a stable identifier the client maps to a translated
 * message (e.g. "errors.invalidCredentials"); nothing internal is ever sent to the browser.
 */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    public fields?: Record<string, string>,
  ) {
    super(code);
  }
}

export const badRequest = (code = "errors.generic", fields?: Record<string, string>) => new AppError(400, code, fields);
export const unauthorized = () => new AppError(401, "errors.unauthorized");
export const forbidden = () => new AppError(403, "errors.forbidden");
export const notFound = (code = "errors.notFound") => new AppError(404, code);
export const tooManyRequests = () => new AppError(429, "errors.rateLimited");

export function zodFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message.startsWith("validation.") ? issue.message : "validation.invalid";
  }
  return fields;
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: { code: err.code, fields: err.fields } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: { code: "validation.invalid", fields: zodFieldErrors(err) } }, { status: 422 });
  }
  logger.error("Unhandled API error", err);
  return NextResponse.json({ error: { code: "errors.generic" } }, { status: 500 });
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("validation.invalid");
  }
  return schema.parse(body);
}

/**
 * CSRF defence for cookie-authenticated mutations: browsers always send `Origin` on
 * cross-site POST/PUT/PATCH/DELETE, so we only accept requests from our own origin.
 * (Session cookies are also SameSite=Lax.)
 */
export function assertSameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (no ambient cookies are relevant there)
  const allowed = new Set([new URL(env.APP_URL).origin, req.nextUrl.origin]);
  if (!allowed.has(origin)) throw forbidden();
}

type Ctx<P> = { params: Promise<P> };
type Handler<P, U> = (req: NextRequest, ctx: { params: P; user: U }) => Promise<Response>;

function wrap<P, U>(resolveUser: () => Promise<U>, handler: Handler<P, U>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      assertSameOrigin(req);
      const user = await resolveUser();
      const params = ctx?.params ? await ctx.params : ({} as P);
      return await handler(req, { params, user });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Public endpoint — the user may or may not be signed in. */
export function publicRoute<P = Record<string, never>>(handler: Handler<P, SessionUser | null>) {
  return wrap<P, SessionUser | null>(getCurrentUser, handler);
}

/** Requires a signed-in user. */
export function userRoute<P = Record<string, never>>(handler: Handler<P, SessionUser>) {
  return wrap<P, SessionUser>(async () => {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();
    return user;
  }, handler);
}

/** Requires an ADMIN — checked on the server for every request. */
export function adminRoute<P = Record<string, never>>(handler: Handler<P, SessionUser>) {
  return wrap<P, SessionUser>(async () => {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();
    if (user.role !== "ADMIN") throw forbidden();
    return user;
  }, handler);
}

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
