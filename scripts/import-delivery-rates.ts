/**
 * Import Boulboul's ZR Express delivery rates into DeliveryRule (one rule per wilaya).
 * Idempotent: existing wilaya-level rules are updated, commune-specific rules are left alone.
 * Run: npm run import-delivery-rates
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/backend/generated/prisma/client";
import { ZR_EXPRESS_RATES } from "../prisma/data/zr-express-rates";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  let created = 0;
  let updated = 0;
  for (const [wilayaCode, fee, stopDeskFee, returnFee] of ZR_EXPRESS_RATES) {
    const data = { fee, stopDeskFee, returnFee, isActive: true, note: "ZR Express — tarif du 05/10/2026" };
    const existing = await prisma.deliveryRule.findFirst({ where: { wilayaCode, commune: null } });
    if (existing) {
      await prisma.deliveryRule.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.deliveryRule.create({ data: { wilayaCode, commune: null, ...data } });
      created++;
    }
  }
  console.log(`✔ ZR Express rates: ${created} created, ${updated} updated (${ZR_EXPRESS_RATES.length} wilayas).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
