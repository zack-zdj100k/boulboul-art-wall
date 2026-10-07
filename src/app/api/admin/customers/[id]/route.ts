import { NextResponse } from "next/server";
import { z } from "zod";
import { emailSchema, phoneSchema } from "@/lib/validation";
import { adminRoute, parseJson } from "@/server/http";
import { deleteUserByAdmin, updateUserByAdmin } from "@/server/services/user-admin";

const schema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: emailSchema.optional(),
  phone: z.preprocess((v) => (v === "" ? null : v), phoneSchema.nullable()).optional(),
  age: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(13).max(120).nullable()).optional(),
  isActive: z.boolean().optional(),
  role: z.enum(["CUSTOMER", "ADMIN"]).optional(),
});

export const PATCH = adminRoute<{ id: string }>(async (req, { params, user }) => {
  const data = await parseJson(req, schema);
  const updated = await updateUserByAdmin(params.id, data, user);
  return NextResponse.json({ id: updated.id, role: updated.role, isActive: updated.isActive });
});

export const DELETE = adminRoute<{ id: string }>(async (_req, { params, user }) => {
  await deleteUserByAdmin(params.id, user);
  return NextResponse.json({ deleted: true });
});
