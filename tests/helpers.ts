import { prisma } from "@/server/db";
import { hashPassword } from "@/server/auth/password";

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

export async function createUser(role: "ADMIN" | "CUSTOMER" = "CUSTOMER", email = `${role.toLowerCase()}-${Date.now()}@test.dz`) {
  return prisma.user.create({ data: { email, passwordHash: await hashPassword("Password123"), fullName: `Test ${role}`, role } });
}

/**
 * A canvas with measures created by the admin:
 *  50×50 = 3 000 · 80×120 = 12 000 · 100×100 = 10 000 · 150×150 = 20 000 · 65×90 = 5 200 ("Medium Custom")
 * Sur Mesure is off (pass overrides to enable it), plus a fixed-price frame (1 000) and option (2 500).
 */
export async function createProductFixture(overrides: Record<string, unknown> = {}) {
  const frame = await prisma.frameOption.create({ data: { name: "Cadre test", price: 1000 } });
  const extra = await prisma.extraOption.create({ data: { name: "LED test", price: 2500 } });
  const media = await prisma.media.create({ data: { key: `public/test/${Math.random().toString(36).slice(2)}.jpg`, mime: "image/jpeg", size: 10, originalName: "p.jpg" } });
  const product = await prisma.product.create({
    data: {
      slug: `canvas-test-${Math.random().toString(36).slice(2, 8)}`,
      name: "Canvas test",
      status: "ACTIVE",
      measures: {
        create: [
          { widthCm: 50, heightCm: 50, price: 3_000 },
          { widthCm: 80, heightCm: 120, price: 12_000 },
          { widthCm: 100, heightCm: 100, price: 10_000 },
          { widthCm: 150, heightCm: 150, price: 20_000 },
          { widthCm: 65, heightCm: 90, price: 5_200, label: "Medium Custom" },
        ],
      },
      frames: { create: [{ frameId: frame.id, isDefault: true }] },
      extras: { create: [{ extraId: extra.id }] },
      images: { create: [{ mediaId: media.id }] },
      ...overrides,
    },
  });
  return { product, frame, extra };
}

export const customer = {
  customerName: "Amina Test",
  email: "amina@test.dz",
  phone: "0551234567",
  wilayaCode: "16",
  commune: "Bab Ezzouar",
  address: "Cité test, bâtiment 1",
  notes: undefined as string | undefined,
};

/** Sur Mesure: 60 × 80 = 5 000 DA, ± 200 DA per 10 cm of length and of height. */
export const surMesureFixture = { allowCustomSize: true, refWidthCm: 60, refHeightCm: 80, refPrice: 5_000, widthStepPrice: 200, heightStepPrice: 200 };
