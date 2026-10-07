import "server-only";
import type { z } from "zod";
import type { registerSchema } from "@/shared/lib/validation";
import { prisma } from "@/backend/db";
import { getDummyHash, hashPassword, verifyPassword } from "@/backend/auth/password";
import { AppError } from "@/backend/http";

export async function registerUser(input: z.infer<typeof registerSchema>) {
  const exists = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) throw new AppError(409, "errors.emailTaken", { email: "errors.emailTaken" });
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        age: input.age,
        phone: input.phone,
        referralSource: input.referralSource,
        referralOther: input.referralSource === "OTHER" ? (input.referralOther ?? null) : null,
        role: "CUSTOMER", // never taken from the request
      },
      select: { id: true, fullName: true, email: true, role: true },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new AppError(409, "errors.emailTaken", { email: "errors.emailTaken" });
    throw err;
  }
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    await verifyPassword(password, await getDummyHash()); // equalise timing
    throw new AppError(401, "errors.invalidCredentials");
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new AppError(401, "errors.invalidCredentials");
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { id: user.id, fullName: user.fullName, email: user.email, role: user.role };
}
