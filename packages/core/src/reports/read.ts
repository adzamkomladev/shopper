import { and, between, eq, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import {
  branch,
  store,
  storeDay,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import type { Queryable } from "../types";
import { columnList, datesBetween, inBranches } from "./days";
import { foldProducts, productColumns } from "./fold/products";
import { foldSales, salesColumns } from "./fold/sales";
import { foldTenders, tenderColumns } from "./fold/tenders";
import type { FoldFilter, ReportRange } from "./types";

const sources = {
  sales: { table: sql`report_sales`, columns: salesColumns, fold: foldSales },
  tenders: { table: sql`report_tender`, columns: tenderColumns, fold: foldTenders },
  products: { table: sql`report_product`, columns: productColumns, fold: foldProducts },
} satisfies Record<
  string,
  { table: SQL; columns: readonly string[]; fold: (filter: FoldFilter) => SQL }
>;

/**
 * Runs a report's reads in one read-only snapshot: which days are rolled, and the rows then read, see the same
 * moment, so a rollup or late sale committing in between can neither drop a day nor count it twice.
 */
export const inSnapshot = <T>(db: ShopperDatabase, read: (tx: ShopperTransaction) => Promise<T>) =>
  db.transaction(read, { isolationLevel: "repeatable read", accessMode: "read only" });

/**
 * The rows of one report grain for a range, as one SQL source (run it inside `inSnapshot`): the rollup rows of every store day that is
 * current, and a live fold of the rest (today, and days a late sale or refund made stale). The two never
 * overlap, so any grouping over the source is exact.
 */
export async function reportSource(
  db: ShopperTransaction,
  grain: keyof typeof sources,
  range: ReportRange,
): Promise<SQL> {
  const source = sources[grain];
  const stores = await storesOf(db, range);
  const rolled = stores.length
    ? await db
        .select({ storeId: storeDay.storeId, day: storeDay.day })
        .from(storeDay)
        .where(
          and(
            eq(storeDay.orgId, range.orgId),
            inArray(storeDay.storeId, stores),
            between(storeDay.day, range.from, range.to),
            isNotNull(storeDay.rolledAt),
          ),
        )
    : [];
  const current = new Set(rolled.map((row) => `${row.storeId}|${row.day}`));
  const live = stores.flatMap((storeId) =>
    datesBetween(range.from, range.to)
      .filter((day) => !current.has(`${storeId}|${day}`))
      .map((day) => ({ storeId, day })),
  );
  const r = sql`r`;
  const rollup = sql`SELECT ${columnList(source.columns, "r")} FROM ${source.table} r
    JOIN store_day d ON d.org_id = r.org_id AND d.store_id = r.store_id AND d.day = r.day AND d.rolled_at IS NOT NULL
    WHERE r.org_id = ${range.orgId} AND r.day BETWEEN ${range.from}::date AND ${range.to}::date
      ${inBranches(r, range.branchIds)}`;
  if (live.length === 0) return rollup;
  return sql`${rollup} UNION ALL ${source.fold({ orgId: range.orgId, days: live, branchIds: range.branchIds })}`;
}

/** The stores whose rows the range can hold: every store, or the stores of the branches it is limited to. */
async function storesOf(db: Queryable, range: ReportRange) {
  if (!range.branchIds) {
    const rows = await db.select({ id: store.id }).from(store).where(eq(store.orgId, range.orgId));
    return rows.map((row) => row.id);
  }
  if (range.branchIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ id: branch.storeId })
    .from(branch)
    .where(and(eq(branch.orgId, range.orgId), inArray(branch.id, range.branchIds)));
  return rows.map((row) => row.id);
}
