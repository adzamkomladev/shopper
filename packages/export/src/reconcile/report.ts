import { sql, type SQL } from "drizzle-orm";
import { foldSales } from "@shopper/core/reports";
import type { ShopperDatabase, ShopperTransaction } from "@shopper/db-pg";
import { EXCLUDED_TABLES, HIDDEN_COLUMNS } from "../dump/tables";
import type { DayTotals, ReconciliationReport } from "../types";

/** The per-day figures compared: what an owner reads as the day's sales and tax. */
export const DAY_FIGURES = [
  "sales",
  "gross",
  "tax",
  "vat",
  "nhil",
  "getfund",
  "covid",
  "net",
  "refunds",
  "refund_gross",
  "refund_tax",
] as const;

/**
 * What a move is checked by, run the same way on the database it left and the one it arrived in: per archived table its
 * row count and an MD5 over its rows' JSON text (secrets left out, sorted by the text itself, so no key order is
 * assumed), and per Accra day the sales and tax re-derived from the raw sale and refund rows. One read-only snapshot
 * in UTC, so both sides print timestamps alike. `auditUpTo` cuts the audit chain where the archive ended: both sides
 * audit the move itself after it.
 */
export async function reconciliationReport(
  db: ShopperDatabase,
  orgId: string,
  options: { auditUpTo?: number } = {},
): Promise<ReconciliationReport> {
  return db.transaction(
    async (tx) => {
      await tx.execute(sql`set local timezone = 'UTC'`);
      const tables: ReconciliationReport["tables"] = {};
      for (const table of await archivedTables(tx)) {
        const hidden = sql`ARRAY[${sql.join(
          (HIDDEN_COLUMNS[table] ?? []).map((c) => sql`${c}`),
          sql`, `,
        )}]::text[]`;
        const { rows } = await tx.execute<{ rows: number; checksum: string }>(sql`
          select count(*)::int as rows, md5(coalesce(string_agg(line, E'\n' order by line), '')) as checksum
          from (select (to_jsonb(t) - ${hidden})::text as line from ${sql.identifier(table)} t
            where ${scope(table, orgId, options)}) rows`);
        tables[table] = rows[0]!;
      }
      return { auditUpTo: options.auditUpTo ?? null, tables, days: await days(tx, orgId) };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

/** Tables an archive carries: every one with an `org_id`, less those it leaves out (as `dumpOrg` reads them). */
async function archivedTables(tx: ShopperTransaction) {
  const { rows } = await tx.execute<{ table_name: string }>(sql`
    select c.table_name from information_schema.columns c
    join information_schema.tables t using (table_schema, table_name)
    where c.table_schema = 'public' and c.column_name = 'org_id' and t.table_type = 'BASE TABLE'
    order by c.table_name`);
  return rows.map((row) => row.table_name).filter((table) => !(table in EXCLUDED_TABLES));
}

/**
 * The org's rows of a table, less the move's own bookkeeping: the audit rows after the archive's last, and the archive
 * workflow's run and steps, which the sealing workflow finishes after its own snapshot.
 */
function scope(table: string, orgId: string, options: { auditUpTo?: number }): SQL {
  const own = sql`org_id = ${orgId}`;
  if (table === "audit_log" && options.auditUpTo !== undefined)
    return sql`${own} and chain_seq <= ${options.auditUpTo}`;
  if (table === "workflow_run" || table === "workflow_step")
    return sql`${own} and instance_id not like 'export-archive\\_%'`;
  return own;
}

async function days(tx: ShopperTransaction, orgId: string) {
  const { rows: storeDays } = await tx.execute<{ storeId: string; day: string }>(sql`
    select distinct store_id::text as "storeId", (occurred_at at time zone 'Africa/Accra')::date::text as day
    from (select store_id, occurred_at from sale where org_id = ${orgId}
      union all select store_id, occurred_at from refund where org_id = ${orgId}
      union all select store_id, occurred_at from order_report_line where org_id = ${orgId}) x
    order by 2, 1`);
  if (!storeDays.length) return {};
  const figures = sql.raw(DAY_FIGURES.map((f) => `sum(${f})::text as ${f}`).join(", "));
  const { rows } = await tx.execute<{ day: string } & DayTotals>(sql`
    select day::text as day, ${figures} from (${foldSales({ orgId, days: storeDays })}) f
    group by day order by day`);
  return Object.fromEntries(
    rows.map((row) => [
      row.day,
      Object.fromEntries(DAY_FIGURES.map((f) => [f, row[f]])) as DayTotals,
    ]),
  );
}
