import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { fromBigInt, mulRatio, money, type Money } from "@shopper/money";
import { branch, product, user } from "@shopper/db-pg";
import type { Queryable } from "../types";
import type { ReportRange } from "./types";

/** `sum(column)::text AS column` for each column: bigint sums come back exact, as text. */
export const sums = (columns: readonly string[]) =>
  sql.raw(columns.map((column) => `coalesce(sum(${column}), 0)::text AS ${column}`).join(", "));

/** A summed amount read back as money. */
export const amount = (value?: string | null): Money => fromBigInt(BigInt(value ?? 0));
/** A summed count or quantity (thousandths) read back as a number. */
export const count = (value?: string | null) => Number(value ?? 0);

/** Amount per transaction, rounded half up; nothing when there were none. */
export const perSale = (total: Money, sales: number) =>
  sales > 0 ? mulRatio(total, 1, sales) : money(0);
/** `part` as basis points of `whole`, half up; 0 when the whole is 0. A refund-only (negative) whole works too. */
export const shareBps = (part: Money, whole: Money) =>
  whole === 0
    ? 0
    : Number(mulRatio(money(Math.sign(whole) * part), 10_000, money(Math.abs(whole))));
/**
 * The change from `before` to `now` in basis points of the size of `before`, so a rise from a negative day is
 * positive; null when there is nothing to compare with.
 */
export const changeBps = (now: Money, before: Money) =>
  before === 0 ? null : Number(mulRatio(money(now - before), 10_000, money(Math.abs(before))));

/** The range a query reaches: its one branch, else the caller's branches, else every branch. */
export const reportRange = (
  orgId: string,
  query: { from: string; to: string; branchId?: string },
  scope?: string[],
): ReportRange => ({
  orgId,
  from: query.from,
  to: query.to,
  branchIds: query.branchId ? [query.branchId] : scope,
});

/** The names behind ids, for labels: branches, cashiers or products of the org. */
export async function namesOf(
  db: Queryable,
  orgId: string,
  kind: "branch" | "cashier",
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, string>();
  const table = kind === "branch" ? branch : user;
  const rows = await db
    .select({ id: table.id, name: table.name })
    .from(table)
    .where(and(eq(table.orgId, orgId), inArray(table.id, ids)));
  return new Map(rows.map((row) => [row.id, row.name]));
}

export async function productsOf(db: Queryable, orgId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, { sku: string; name: string }>();
  const rows = await db
    .select({ id: product.id, sku: product.sku, name: product.name })
    .from(product)
    .where(and(eq(product.orgId, orgId), inArray(product.id, ids)));
  return new Map(rows.map((row) => [row.id, { sku: row.sku, name: row.name }]));
}

/** Runs `SELECT ... FROM (source) x` and returns its rows. */
export async function grouped(db: Queryable, select: SQL, source: SQL, rest: SQL = sql``) {
  const { rows } = await db.execute<Record<string, string>>(
    sql`SELECT ${select} FROM (${source}) x ${rest}`,
  );
  return rows;
}
