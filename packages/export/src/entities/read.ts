import { sql } from "drizzle-orm";
import type { ReportCell } from "@shopper/core/reports";
import type { ShopperDatabase, ShopperTransaction } from "@shopper/db-pg";
import type { DayRange, EntityDefinition } from "../types";

const FIRST_ID = "00000000-0000-0000-0000-000000000000";

type Reader = Pick<ShopperDatabase | ShopperTransaction, "execute">;

const where = (def: EntityDefinition, orgId: string, range?: DayRange) =>
  range && def.day
    ? sql`t.org_id = ${orgId} AND (${def.day})::date BETWEEN ${range.from}::date AND ${range.to}::date`
    : sql`t.org_id = ${orgId}`;

export async function countRows(
  db: Reader,
  def: EntityDefinition,
  orgId: string,
  range?: DayRange,
) {
  const { rows } = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM ${def.from} WHERE ${where(def, orgId, range)}`,
  );
  return rows[0]!.n;
}

/** The entity's rows as report cells, a page at a time in id order so nothing holds the whole sheet unless it must. */
export async function* entityPages(
  db: Reader,
  def: EntityDefinition,
  orgId: string,
  range: DayRange | undefined,
  pageRows: number,
  /** The rows the audit row counted: the export's own audit row arrives after the count and is cut by this. */
  limit: number,
): AsyncGenerator<ReportCell[][]> {
  const select = sql.join(
    def.columns.map((column, i) => sql`${column.sql} AS ${sql.identifier(`c${i}`)}`),
    sql`, `,
  );
  const cells = (row: Record<string, unknown>) =>
    def.columns.map((column, i): ReportCell => {
      const value = row[`c${i}`];
      return column.kind === "text"
        ? { kind: "text", value: value === null ? "" : String(value as string | number) }
        : { kind: column.kind, value: value === null ? null : Number(value) };
    });
  if (def.paged === false) {
    const { rows } = await db.execute(
      sql`SELECT ${select} FROM ${def.from} WHERE ${where(def, orgId, range)} ORDER BY ${def.order}`,
    );
    yield rows.slice(0, limit).map(cells);
    return;
  }
  let last = FIRST_ID;
  let remaining = limit;
  for (;;) {
    const { rows } = await db.execute<Record<string, unknown> & { key: string }>(sql`
      SELECT ${select}, t.id::text AS key FROM ${def.from}
      WHERE ${where(def, orgId, range)} AND t.id > ${last}::uuid ORDER BY t.id LIMIT ${pageRows}`);
    if (!rows.length || remaining <= 0) return;
    yield rows.slice(0, remaining).map(cells);
    remaining -= rows.length;
    if (rows.length < pageRows) return;
    last = rows.at(-1)!.key;
  }
}
