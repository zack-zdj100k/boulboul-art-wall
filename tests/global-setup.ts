import { execSync } from "node:child_process";
import { config } from "dotenv";

export default function setup() {
  config({ path: ".env" });
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !url.includes("test")) throw new Error("TEST_DATABASE_URL must point to a dedicated *test* database");
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
}
