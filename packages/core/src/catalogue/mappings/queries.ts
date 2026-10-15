import { asc, eq } from "drizzle-orm";
import { barcodeMapping } from "@shopper/db-pg";
import type { Queryable } from "../../types";

export const mappingView = (row: typeof barcodeMapping.$inferSelect) => ({
  id: row.id,
  prefix: row.prefix,
  product: { start: row.productStart, length: row.productLength },
  value: { start: row.valueStart, length: row.valueLength },
  kind: row.kind,
  ...(row.unit ? { unit: row.unit } : {}),
  decimals: row.decimals,
});

export async function listBarcodeMappings(db: Queryable, orgId: string) {
  const rows = await db
    .select()
    .from(barcodeMapping)
    .where(eq(barcodeMapping.orgId, orgId))
    .orderBy(asc(barcodeMapping.prefix));
  return rows.map(mappingView);
}
