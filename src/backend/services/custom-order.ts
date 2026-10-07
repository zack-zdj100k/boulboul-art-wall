import "server-only";
import type { CustomOrderStatus } from "@/backend/generated/prisma/client";
import { getWilaya } from "@/shared/lib/algeria";
import { findCommune } from "@/shared/lib/communes";
import type { CustomOrderInput } from "@/shared/lib/validation";
import { verifyUploadToken } from "@/backend/auth/tokens";
import { prisma } from "@/backend/db";
import { getStorage } from "@/backend/storage";
import { AppError, badRequest } from "@/backend/http";
import { audit } from "./audit";
import { nextCustomReference } from "./counters";
import { computeCustomQuote, estimateCustom, type CustomQuoteInput } from "@/shared/lib/quote";
import { snapshotExtras } from "./extras";
import { getCustomEstimateConfig, getSettings } from "./settings";

// CustomOrderService — design requests reviewed manually by Boulboul. No automatic emails.

export async function createCustomOrder(input: CustomOrderInput, userId: string | null) {
  const limits = await getSettings(["custom.minWidthCm", "custom.maxWidthCm", "custom.minHeightCm", "custom.maxHeightCm"]);
  if (input.widthCm != null && (input.widthCm < limits["custom.minWidthCm"] || input.widthCm > limits["custom.maxWidthCm"])) {
    throw badRequest("errors.invalidSize", { widthCm: "errors.invalidSize" });
  }
  if (input.heightCm != null && (input.heightCm < limits["custom.minHeightCm"] || input.heightCm > limits["custom.maxHeightCm"])) {
    throw badRequest("errors.invalidSize", { heightCm: "errors.invalidSize" });
  }

  // The design must be a private, still-unused upload made by this visitor (proved by the HMAC token).
  if (input.designMediaId) {
    const media = await prisma.media.findUnique({ where: { id: input.designMediaId } });
    const ownedOk =
      media &&
      media.visibility === "PRIVATE" &&
      verifyUploadToken(media.id, input.designToken) &&
      (media.uploadedById === null || media.uploadedById === userId);
    const unused = media && (await prisma.customOrder.count({ where: { designMediaId: media.id } })) === 0;
    if (!ownedOk || !unused) throw badRequest("validation.invalid", { designMediaId: "validation.invalid" });
  }

  const frame = input.frameId ? await prisma.frameOption.findFirst({ where: { id: input.frameId, isActive: true } }) : null;
  if (input.frameId && !frame) throw badRequest("errors.invalidOption", { frameId: "errors.invalidOption" });

  const extras = input.extraIds.length
    ? await prisma.extraOption.findMany({ where: { id: { in: input.extraIds }, isActive: true, availableForCustom: true } })
    : [];
  if (extras.length !== new Set(input.extraIds).size) throw badRequest("errors.invalidOption", { extraIds: "errors.invalidOption" });

  const wilaya = input.wilayaCode ? getWilaya(input.wilayaCode) : undefined;
  // Indicative estimate (Sur Mesure rule + options); Boulboul still sets the final quote manually.
  const estimate = estimateCustom(await getCustomEstimateConfig(), input.widthCm, input.heightCm, [frame?.price ?? 0, ...extras.map((e) => e.price)]);
  const extrasSnapshot = snapshotExtras(
    extras.map((e) => ({ id: e.id, name: e.name, price: e.price })),
    extras,
    input.extraChoices,
  );

  return prisma.$transaction(async (tx) => {
    const reference = await nextCustomReference(tx);
    return tx.customOrder.create({
      data: {
        reference,
        userId,
        customerName: input.customerName,
        email: input.email,
        phone: input.phone,
        wilayaCode: wilaya?.code ?? null,
        wilayaName: wilaya?.fr ?? null,
        commune: wilaya && input.commune ? ((await findCommune(wilaya.code, input.commune)) ?? input.commune) : (input.commune ?? null),
        address: input.address ?? null,
        designMediaId: input.designMediaId ?? null,
        description: input.description ?? "",
        widthCm: input.widthCm ?? null,
        heightCm: input.heightCm ?? null,
        frameId: frame?.id ?? null,
        frameName: frame?.name ?? null,
        extras: extrasSnapshot,
        estimatedPrice: estimate?.total ?? null,
        otherIdea: input.otherIdea ?? null,
        notes: input.notes ?? null,
      },
    });
  });
}

export async function updateCustomOrder(
  id: string,
  data: { status?: CustomOrderStatus; adminNotes?: string | null } & CustomQuoteInput,
  actorId: string,
) {
  const existing = await prisma.customOrder.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "errors.notFound");
  // Merge the submitted quote fields over the stored ones, then recompute the total server-side.
  const quote = {
    price: data.price !== undefined ? data.price : existing.price,
    discountType: data.discountType !== undefined ? data.discountType : existing.discountType,
    discountValue: data.discountValue !== undefined ? data.discountValue : existing.discountValue,
    deliveryFee: data.deliveryFee !== undefined ? data.deliveryFee : existing.deliveryFee,
  };
  const { total } = computeCustomQuote(quote);
  const updated = await prisma.customOrder.update({
    where: { id },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.adminNotes !== undefined ? { adminNotes: data.adminNotes } : {}),
      ...quote,
      discountValue: quote.discountType ? quote.discountValue : null,
      total,
    },
  });
  await audit({
    actorId,
    action: "customOrder.update",
    entityType: "CustomOrder",
    entityId: id,
    metadata: { from: existing.status, to: updated.status, notesChanged: data.adminNotes !== undefined, total: updated.total },
  });
  return updated;
}

/** Permanently delete a custom request (admin), including its private design file if unused elsewhere. */
export async function deleteCustomOrder(id: string, actorId: string) {
  const request = await prisma.customOrder.findUnique({ where: { id }, include: { designMedia: true } });
  if (!request) throw new AppError(404, "errors.notFound");
  await prisma.customOrder.delete({ where: { id } });
  const design = request.designMedia;
  if (design && design.visibility === "PRIVATE" && (await prisma.customOrder.count({ where: { designMediaId: design.id } })) === 0) {
    await prisma.media.delete({ where: { id: design.id } }).catch(() => {});
    await getStorage().delete(design.key).catch(() => {});
  }
  await audit({
    actorId,
    action: "customOrder.delete",
    entityType: "CustomOrder",
    entityId: id,
    metadata: { reference: request.reference, customerName: request.customerName, total: request.total, status: request.status },
  });
}
