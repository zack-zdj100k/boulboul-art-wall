import { NextResponse, type NextRequest } from "next/server";

// Fast pre-check only: no session cookie → redirect to login. The real authorisation
// (session validity + ADMIN role) is enforced server-side in every page and API route.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has("baw_session");
  const isAuthPage = pathname.startsWith("/account/login") || pathname.startsWith("/account/register");
  if (!hasSession && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/account/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/account"],
};
