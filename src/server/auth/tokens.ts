import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";

/** HMAC token proving the bearer performed an upload (anonymous visitors have no session). */
export function signUploadToken(mediaId: string) {
  return createHmac("sha256", env.SESSION_SECRET).update(`upload:${mediaId}`).digest("base64url");
}

export function verifyUploadToken(mediaId: string, token: string | null | undefined) {
  if (!token) return false;
  const expected = Buffer.from(signUploadToken(mediaId));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
