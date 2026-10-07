import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma, type Tx } from "@/backend/db";

export type AuditEntry = {
  actorId: string | null;
  action: string; // "product.create", "order.status", "review.moderate"…
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/** Never pass passwords, tokens or other secrets in `metadata`. */
export async function audit(entry: AuditEntry, tx: Tx = prisma) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata,
    },
  });
}
