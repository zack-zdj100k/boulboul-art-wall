import "server-only";
import type { Tx } from "@/backend/db";

/** Atomically increments and returns a named counter (INSERT … ON CONFLICT DO UPDATE). */
export async function nextCounterValue(tx: Tx, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  return Number(rows[0].value);
}

export function algiersYear(date = new Date()) {
  return Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Africa/Algiers" }).format(date));
}

export async function nextOrderNumber(tx: Tx, date = new Date()) {
  const year = algiersYear(date);
  const n = await nextCounterValue(tx, `order:${year}`);
  return `BAW-${year}-${String(n).padStart(6, "0")}`;
}

export async function nextCustomReference(tx: Tx, date = new Date()) {
  const year = algiersYear(date);
  const n = await nextCounterValue(tx, `custom:${year}`);
  return `BAW-C-${year}-${String(n).padStart(6, "0")}`;
}
