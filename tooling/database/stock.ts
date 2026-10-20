import { asc, eq } from "drizzle-orm";
import { v7 } from "uuid";
import type { CommandContext } from "../../packages/audit/src/index";
import { saveSupplier } from "../../packages/core/src/catalogue/index";
import { adjustStock, receiveStock, setReorder } from "../../packages/core/src/stock/index";
import { product, supplier, type ShopperDatabase } from "../../packages/db/pg/src/index";

const RECEIVED = [24_000, 3_000, 48_000, 6_000, 12_000, 1_500, 30_000, 9_000];
// Levels for the first four: the second and fourth sit under theirs, so the stock list has Low rows.
const LEVELS = [5_000, 6_000, 10_000, 8_000];

/**
 * Gives the first branch some stock so the portal's stock screens are not empty: a delivery of the
 * first products, reorder levels on a few (two of them low) and a damaged item. Does nothing for
 * an empty catalogue. Everything goes through commands, so it is audited.
 */
export async function seedStock(db: ShopperDatabase, context: CommandContext, branchId: string) {
  const products = await db
    .select({ id: product.id })
    .from(product)
    .where(eq(product.orgId, context.orgId))
    .orderBy(asc(product.sku))
    .limit(RECEIVED.length);
  if (products.length === 0) return;
  const [known] = await db
    .select({ id: supplier.id })
    .from(supplier)
    .where(eq(supplier.orgId, context.orgId))
    .orderBy(asc(supplier.name))
    .limit(1);
  const supplierId =
    known?.id ?? (await saveSupplier(db, context, { data: { name: "Dev wholesaler" } })).id;
  const now = new Date();
  await receiveStock(db, context, {
    receipt: {
      id: v7(),
      branchId,
      supplierId,
      reference: "Dev delivery",
      lines: products.map(({ id }, index) => ({
        productId: id,
        quantityThousandths: RECEIVED[index]!,
        unitCost: 20_000 + index * 15_000,
      })),
    },
    now,
  });
  await adjustStock(db, context, {
    adjustment: {
      id: v7(),
      branchId,
      cause: "damaged",
      lines: [{ productId: products[0]!.id, quantityThousandths: 1_000 }],
    },
    now: new Date(now.getTime() + 1),
  });
  for (const [index, levelThousandths] of LEVELS.entries())
    await setReorder(db, context, {
      reorder: { branchId, productId: products[index]!.id, levelThousandths },
    });
}
