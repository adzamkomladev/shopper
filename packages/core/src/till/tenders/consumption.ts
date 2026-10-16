import { and, eq, sql } from "drizzle-orm";
import { localSale, type TillSqlite } from "@shopper/db-sqlite";

export async function paymentSale(tx: TillSqlite, orgId: string, reference: string) {
  const [used] = await tx
    .select({ id: localSale.id })
    .from(localSale)
    .where(
      and(
        eq(localSale.orgId, orgId),
        sql`EXISTS (SELECT 1 FROM json_each(${localSale.payload}, '$.tenders') WHERE json_extract(value, '$.reference') = ${reference})`,
      ),
    )
    .limit(1);
  return used?.id;
}
