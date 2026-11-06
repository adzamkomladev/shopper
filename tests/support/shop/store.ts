// A small online catalogue on a shop world's shop, written straight to the tables the store reads.
//   stockShop(db, shop, categoryName?) -> { storeId, branches: [main, other], category, product(name, over?) }
//   product(name, over)     -> a product with an org price; `over` sets visibility, archiving, stock per branch,
//                              a branch price, a future price, the base unit and the tax class
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { money } from "@shopper/money";
import type { ShopperDatabase } from "@shopper/db-pg";

type Shop = { orgId: string; slug: string };
type Over = {
  visible?: boolean;
  archived?: boolean;
  /** Stock in thousandths per branch index (main 0, other 1). */
  stock?: [number, number];
  /** The shop-wide price; null leaves the product unpriced. */
  price?: number | null;
  /** A price at the other branch that beats the shop's. */
  otherPrice?: number;
  /** A price that starts tomorrow. */
  futurePrice?: number;
  categoryId?: string | null;
  baseUnit?: schema.BaseUnit;
  taxClass?: "standard" | "zero-rated" | "exempt";
};

export async function stockShop(db: ShopperDatabase, shop: Shop, categoryName = "Groceries") {
  const storeId = v7();
  await db.insert(schema.store).values({ id: storeId, orgId: shop.orgId, name: "Main store" });
  const branches = [v7(), v7()] as const;
  for (const [index, id] of branches.entries())
    await db.insert(schema.branch).values({
      id,
      orgId: shop.orgId,
      storeId,
      name: index === 0 ? "Osu" : "Kaneshie",
      code: `B${index}${storeId.slice(-6).toUpperCase()}`,
      createdAt: new Date(Date.UTC(2026, 0, 1 + index)),
    });
  const classes = await db
    .select({ id: schema.taxClass.id, code: schema.taxClass.code })
    .from(schema.taxClass)
    .where(eq(schema.taxClass.orgId, shop.orgId));
  const category = v7();
  await db.insert(schema.category).values({ id: category, orgId: shop.orgId, name: categoryName });
  const product = async (name: string, over: Over = {}) => {
    const id = v7();
    await db.insert(schema.product).values({
      id,
      orgId: shop.orgId,
      sku: `SKU-${name.replace(/\W/g, "").toUpperCase()}-${id.slice(-4)}`,
      name,
      taxClassId: classes.find((row) => row.code === (over.taxClass ?? "standard"))!.id,
      baseUnit: over.baseUnit ?? "each",
      onlineVisible: over.visible ?? true,
      archivedAt: over.archived ? new Date() : null,
      categoryId: over.categoryId === undefined ? category : over.categoryId,
    });
    const prices = [
      ...(over.price === null
        ? []
        : [
            {
              branchId: null,
              amount: over.price ?? 120_000,
              validFrom: new Date("2026-01-01T00:00:00Z"),
            },
          ]),
      ...(over.otherPrice
        ? [
            {
              branchId: branches[1],
              amount: over.otherPrice,
              validFrom: new Date("2026-02-01T00:00:00Z"),
            },
          ]
        : []),
      ...(over.futurePrice
        ? [
            {
              branchId: null,
              amount: over.futurePrice,
              validFrom: new Date(Date.now() + 86_400_000),
            },
          ]
        : []),
    ];
    for (const row of prices)
      await db
        .insert(schema.price)
        .values({ orgId: shop.orgId, productId: id, ...row, amount: money(row.amount) });
    for (const [index, quantity] of (over.stock ?? [5_000, 5_000]).entries())
      if (quantity)
        await db.insert(schema.stockMovement).values({
          orgId: shop.orgId,
          branchId: branches[index]!,
          productId: id,
          reason: "adjustment",
          quantityThousandths: quantity,
          occurredAt: new Date("2026-03-01T08:00:00Z"),
        });
    return id;
  };
  return { storeId, branches, category, product };
}
