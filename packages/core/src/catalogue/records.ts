import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { taxClass } from "@shopper/db-pg";
import type { Queryable } from "../types";
import { uuidV7Schema } from "@shopper/ports";
import { ManagementError } from "../management";

/** Ids are UUIDv7; anything else cannot exist, so it reads as not found. */
export function recordId(id: string) {
  const parsed = v.safeParse(uuidV7Schema, id);
  if (!parsed.success) throw new ManagementError("Record not found");
  return parsed.output.toLowerCase();
}
export function nonEmpty<T extends object>(data: T) {
  if (!Object.values(data).some((value) => value !== undefined))
    throw new ManagementError("Provide at least one field", 400);
  return data;
}
export async function taxClassId(
  tx: Queryable,
  orgId: string,
  code: (typeof taxClass.$inferSelect)["code"],
) {
  const [row] = await tx
    .select({ id: taxClass.id })
    .from(taxClass)
    .where(and(eq(taxClass.orgId, orgId), eq(taxClass.code, code)));
  if (!row) throw new ManagementError("Unknown tax class", 400);
  return row.id;
}
