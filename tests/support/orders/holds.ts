// Online orders holding stock, written straight to the tables, for the StockHold conformance on both runtimes.
//   holdWorld(db, orgId) -> { branchId, otherBranchId, seed(db, branchId, expiresInMs), released(db, orderId) }
// Each call takes its own database handle: a Worker opens a fresh connection per call.
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { money } from "@shopper/money";

export async function holdWorld(db: schema.ShopperDatabase, orgId: string) {
  const [store] = await db.insert(schema.store).values({ orgId, name: "Hold store" }).returning();
  const branches = [v7(), v7()] as const;
  for (const id of branches)
    await db.insert(schema.branch).values({ id, orgId, storeId: store!.id, name: `Branch ${id}` });
  const [taxClass] = await db
    .select()
    .from(schema.taxClass)
    .where(eq(schema.taxClass.orgId, orgId))
    .limit(1);
  const [product] = await db
    .insert(schema.product)
    .values({
      orgId,
      sku: `HOLD-${v7()}`,
      name: "Held tin",
      taxClassId: taxClass!.id,
      baseUnit: "each",
    })
    .returning();
  let cursor = 0n;
  return {
    branchId: branches[0],
    otherBranchId: branches[1],
    async seed(db: schema.ShopperDatabase, branchId: string, expiresInMs: number) {
      const expiresAt = new Date(Date.now() + expiresInMs);
      const zero = money(0);
      const [order] = await db
        .insert(schema.onlineOrder)
        .values({
          orgId,
          storeId: store!.id,
          branchId,
          inboxCursor: (cursor += 1n),
          fulfilment: "pickup",
          slotStart: new Date(Date.now() + 3_600_000),
          slotEnd: new Date(Date.now() + 7_200_000),
          customerName: "Ama Mensah",
          customerPhone: "0241234567",
          viewTokenDigest: v7(),
          idempotencyKey: v7(),
          base: zero,
          vat: zero,
          nhil: zero,
          getfund: zero,
          covid: zero,
          gross: zero,
          holdExpiresAt: expiresAt,
        })
        .returning();
      await db.insert(schema.stockHold).values({
        orgId,
        branchId,
        productId: product!.id,
        orderId: order!.id,
        quantityThousandths: 1_000,
        expiresAt,
      });
      return { orderId: order!.id, expiresAt };
    },
    async released(db: schema.ShopperDatabase, orderId: string) {
      const [row] = await db
        .select({ reason: schema.stockHold.releaseReason })
        .from(schema.stockHold)
        .where(and(eq(schema.stockHold.orgId, orgId), eq(schema.stockHold.orderId, orderId)));
      return row?.reason ?? null;
    },
  };
}
