import { NextResponse } from "next/server";
import { profileSchema } from "@/lib/validation";
import { prisma } from "@/server/db";
import { parseJson, userRoute } from "@/server/http";

export const PATCH = userRoute(async (req, { user }) => {
  const input = await parseJson(req, profileSchema);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { fullName: input.fullName, phone: input.phone, ...(input.age ? { age: input.age } : {}) },
    select: { fullName: true, phone: true, age: true },
  });
  return NextResponse.json({ user: updated });
});
