/**
 * Give an existing account the ADMIN role.
 * Usage: npm run make-admin -- someone@example.com
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/backend/generated/prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run make-admin -- <email>");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

prisma.user
  .update({ where: { email }, data: { role: "ADMIN" }, select: { email: true, fullName: true, role: true } })
  .then((u) => console.log(`✔ ${u.fullName} <${u.email}> is now ${u.role}`))
  .catch(() => {
    console.error(`No account found for ${email} — create it first at /account/register.`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
