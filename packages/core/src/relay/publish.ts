import { eq, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { category, product, taxClass } from "@shopper/db-pg";
import type { RelayBatch } from "../schemas/relay";

/**
 * A box publishes catalogue rows to its relay org: the only writer the relay lock lets through (it sets
 * `shopper.relay` for this transaction). Rows are upserted by the box's ids, so a retried batch changes nothing, and an
 * id that is another org's row is left alone. The relay org's chain records each batch.
 */
export const publishRelay = defineCommand({
  name: "relay.publish",
  async run(tx, context, batch: RelayBatch) {
    const orgId = context.orgId;
    await tx.execute(sql`SELECT set_config('shopper.relay', ${orgId}, true)`);
    for (const row of batch.categories)
      await tx
        .insert(category)
        .values({ orgId, ...row })
        .onConflictDoUpdate({
          target: category.id,
          set: { name: row.name, parentId: row.parentId, updatedAt: sql`now()` },
          setWhere: eq(category.orgId, orgId),
        });
    const classes = new Map(
      (
        await tx
          .select({ id: taxClass.id, code: taxClass.code })
          .from(taxClass)
          .where(eq(taxClass.orgId, orgId))
      ).map((row) => [row.code, row.id]),
    );
    for (const row of batch.products) {
      const fields = {
        sku: row.sku,
        name: row.name,
        categoryId: row.categoryId,
        taxClassId: classes.get(row.taxClass)!,
        baseUnit: row.baseUnit,
        onlineVisible: row.onlineVisible,
      };
      await tx
        .insert(product)
        .values({ orgId, id: row.id, ...fields })
        .onConflictDoUpdate({
          target: product.id,
          set: { ...fields, updatedAt: sql`now()` },
          setWhere: eq(product.orgId, orgId),
        });
    }
    return { categories: batch.categories.length, products: batch.products.length };
  },
  audit: (_input, output) => output,
});
