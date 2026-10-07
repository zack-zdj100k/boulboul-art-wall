import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/backend/auth/session";
import { prisma } from "@/backend/db";
import { getStorage } from "@/backend/storage";

// Serves stored media. PUBLIC files are cacheable; PRIVATE files (customer designs) require
// an admin or the uploader, and are never cached by shared caches.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  const media = await prisma.media.findUnique({ where: { key } });
  if (!media) return new NextResponse("Not found", { status: 404 });

  if (media.visibility === "PRIVATE") {
    const user = await getCurrentUser();
    const allowed = user && (user.role === "ADMIN" || (media.uploadedById && media.uploadedById === user.id));
    if (!allowed) return new NextResponse("Not found", { status: 404 });
  }

  const body = await getStorage().get(key);
  if (!body) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": media.mime,
      "Content-Length": String(body.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": media.visibility === "PUBLIC" ? "public, max-age=31536000, immutable" : "private, no-store",
    },
  });
}
