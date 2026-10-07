import "server-only";
import { Prisma, type Role } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/server/http";
import { audit } from "./audit";

// Admin management of user accounts (customers and admins). Guards: an admin cannot remove
// their own access, and the site always keeps at least one active admin.

async function assertNotLastAdmin(userId: string) {
  const admins = await prisma.user.count({ where: { role: "ADMIN", isActive: true, id: { not: userId } } });
  if (admins === 0) throw new AppError(409, "users.lastAdmin");
}

export async function updateUserByAdmin(
  userId: string,
  data: { fullName?: string; email?: string; phone?: string | null; age?: number | null; isActive?: boolean; role?: Role },
  actor: { id: string },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "errors.notFound");
  const losingAccess = (data.role && data.role !== "ADMIN" && user.role === "ADMIN") || (data.isActive === false && user.isActive);
  if (losingAccess && userId === actor.id) throw new AppError(409, "users.self");
  if (losingAccess && user.role === "ADMIN") await assertNotLastAdmin(userId);

  try {
    const updated = await prisma.user.update({ where: { id: userId }, data });
    // Role or access changed → existing sessions must re-check their rights.
    if ((data.role && data.role !== user.role) || data.isActive === false) await prisma.session.deleteMany({ where: { userId } });
    await audit({
      actorId: actor.id,
      action: "user.update",
      entityType: "User",
      entityId: userId,
      metadata: { fields: Object.keys(data), role: { from: user.role, to: updated.role }, isActive: updated.isActive },
    });
    return updated;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new AppError(409, "errors.emailTaken", { email: "errors.emailTaken" });
    throw err;
  }
}

/**
 * Delete an account. Orders and custom requests are kept (they hold their own customer snapshot)
 * and are simply unlinked; sessions are removed with the account.
 */
export async function deleteUserByAdmin(userId: string, actor: { id: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true, _count: { select: { orders: true } } } });
  if (!user) throw new AppError(404, "errors.notFound");
  if (userId === actor.id) throw new AppError(409, "users.self");
  if (user.role === "ADMIN") await assertNotLastAdmin(userId);
  await prisma.user.delete({ where: { id: userId } });
  await audit({ actorId: actor.id, action: "user.delete", entityType: "User", entityId: userId, metadata: { role: user.role, orders: user._count.orders } });
}
