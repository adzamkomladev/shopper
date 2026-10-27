import { sql, type SQL } from "drizzle-orm";
import type { FoldFilter } from "./types";

/** A row's Accra date (UTC all year, named so a future zone change has one place to go). */
export const accraDay = (alias: SQL) =>
  sql`(${alias}.occurred_at AT TIME ZONE 'Africa/Accra')::date`;
export const accraHour = (alias: SQL) =>
  sql`extract(hour from ${alias}.occurred_at AT TIME ZONE 'Africa/Accra')::smallint`;
/** A column list for SQL, each name optionally qualified by a table alias. Names are code constants, never input. */
export const columnList = (columns: readonly string[], alias?: string) =>
  sql.raw(columns.map((column) => (alias ? `${alias}.${column}` : column)).join(", "));

/** VAT and the three levies of a stored tax snapshot (`path` is a trusted JSON path expression). */
export const taxSum = (path: string) =>
  sql.raw(
    ["vat", "nhil", "getfund", "covid"].map((part) => `(${path}->>'${part}')::bigint`).join(" + "),
  );
/** The instant an Accra date starts. */
export const dayStart = (day: SQL | string) =>
  sql`(${day}::date::timestamp AT TIME ZONE 'Africa/Accra')`;

/**
 * Rows of `alias` (a sale or refund) on the filter's store days: bounded by `occurred_at` first, so the
 * `(org_id, occurred_at)` index does the work, then matched to the exact store and day pairs.
 */
export function onStoreDays(alias: SQL, filter: FoldFilter) {
  const days = filter.days.map((d) => d.day).sort();
  const pairs = sql.join(
    filter.days.map((d) => sql`(${d.storeId}::uuid, ${d.day}::date)`),
    sql`, `,
  );
  return sql`${alias}.org_id = ${filter.orgId}
    AND ${alias}.occurred_at >= ${dayStart(days[0]!)}
    AND ${alias}.occurred_at < ${dayStart(sql`(${days.at(-1)!}::date + 1)`)}
    AND (${alias}.store_id, ${accraDay(alias)}) IN (${pairs})
    ${inBranches(alias, filter.branchIds)}`;
}

/** `AND alias.branch_id IN (...)`, or nothing for every branch. An empty list matches no rows. */
export function inBranches(alias: SQL, branchIds?: string[]) {
  if (!branchIds) return sql``;
  if (branchIds.length === 0) return sql`AND false`;
  return sql`AND ${alias}.branch_id IN (${sql.join(
    branchIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}

/** Every Accra date from `from` to `to`, inclusive. */
export function datesBetween(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const count = Math.round((Date.parse(`${to}T00:00:00.000Z`) - start) / DAY_MS) + 1;
  return Array.from({ length: Math.max(0, count) }, (_, i) =>
    new Date(start + i * DAY_MS).toISOString().slice(0, 10),
  );
}
const DAY_MS = 86_400_000;
