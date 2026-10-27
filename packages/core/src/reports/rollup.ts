import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import {
  reportProduct,
  reportSales,
  reportTender,
  storeDay,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { columnList } from "./days";
import { foldProducts, productColumns } from "./fold/products";
import { foldSales, salesColumns } from "./fold/sales";
import { foldTenders, tenderColumns } from "./fold/tenders";

/** How far back one rollup catches up: a chain dead for longer leaves the older days folded live. */
const CATCH_UP_DAYS = 400;

/**
 * The nightly rollup of one store: `through` and every earlier day a sale or refund has made stale are folded
 * again from the raw rows into the report tables, and marked current. Rerunning it changes nothing.
 */
export const rollStoreDays = defineCommand({
  name: "report.rollup",
  async run(tx, ctx, input: { storeId: string; through: string }) {
    await tx
      .insert(storeDay)
      .values({ orgId: ctx.orgId, storeId: input.storeId, day: input.through })
      .onConflictDoNothing();
    const stale = await tx
      .select({ day: storeDay.day })
      .from(storeDay)
      .where(
        and(
          eq(storeDay.orgId, ctx.orgId),
          eq(storeDay.storeId, input.storeId),
          lte(storeDay.day, input.through),
          isNull(storeDay.rolledAt),
        ),
      )
      .orderBy(asc(storeDay.day))
      .limit(CATCH_UP_DAYS);
    const days = stale.map((row) => row.day);
    if (days.length === 0) return { days };
    const filter = { orgId: ctx.orgId, days: days.map((day) => ({ storeId: input.storeId, day })) };
    const these = sql.join(
      days.map((day) => sql`${day}::date`),
      sql`, `,
    );
    for (const table of [reportSales, reportTender, reportProduct])
      await tx.execute(
        sql`DELETE FROM ${table} WHERE org_id = ${ctx.orgId} AND store_id = ${input.storeId} AND day IN (${these})`,
      );
    await tx.execute(
      sql`INSERT INTO report_sales (${columnList(salesColumns)}) ${foldSales(filter)}`,
    );
    await tx.execute(
      sql`INSERT INTO report_tender (${columnList(tenderColumns)}) ${foldTenders(filter)}`,
    );
    await tx.execute(
      sql`INSERT INTO report_product (${columnList(productColumns)}) ${foldProducts(filter)}`,
    );
    await tx.execute(
      sql`UPDATE store_day SET rolled_at = now(), updated_at = now()
        WHERE org_id = ${ctx.orgId} AND store_id = ${input.storeId} AND day IN (${these})`,
    );
    return { days };
  },
  audit: (input, output) => ({ storeId: input.storeId, through: input.through, days: output.days }),
  details: (input) => ({ entity: "store", entityId: input.storeId }),
});

/**
 * Marks the store's day of `at` stale, inside the command that adds a sale or refund to it: the next rollup folds
 * it again, and until then readers fold it live. Commands hold the org's lock, so a rollup never runs between.
 */
export async function touchStoreDay(
  tx: ShopperTransaction,
  orgId: string,
  storeId: string,
  at: Date,
) {
  await tx.execute(sql`INSERT INTO store_day (org_id, store_id, day)
    VALUES (${orgId}, ${storeId}, (${at.toISOString()}::timestamptz AT TIME ZONE 'Africa/Accra')::date)
    ON CONFLICT (org_id, store_id, day) DO UPDATE SET rolled_at = NULL, updated_at = now()`);
}
