import { NextResponse } from "next/server";
import { signUploadToken } from "@/backend/auth/tokens";
import { badRequest, clientIp, publicRoute } from "@/backend/http";
import { rateLimit } from "@/backend/rate-limit";
import { uploadImage } from "@/backend/services/media";

// Customer design upload for /customize. Stored PRIVATE: only admins (and the uploader) can read it.
export const POST = publicRoute(async (req, { user }) => {
  rateLimit(`design-upload:${clientIp(req)}`, 10, 15 * 60_000);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("validation.required");
  const media = await uploadImage({ file, visibility: "PRIVATE", userId: user?.id ?? null });
  return NextResponse.json({ id: media.id, token: signUploadToken(media.id), name: media.originalName, size: media.size }, { status: 201 });
});
