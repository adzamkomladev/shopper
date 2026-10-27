import * as v from "valibot";
import { sql } from "drizzle-orm";
import type { ShopperDatabase } from "@shopper/db-pg";
import { ManagementError } from "../management";
import { inSnapshot } from "../reports/read";
import type { ReportCell, ReportTable } from "../reports/types";
import { matching } from "./list";
import { transactionQuery } from "./schemas/base";
import type { TransactionRow } from "./types";

const LIMIT = 50_000;

/** Every transaction the explorer's filters match, newest first, as a table for the CSV export. */
export async function transactionsTable(
  db: ShopperDatabase,
  orgId: string,
  raw: Record<string, string>,
  scope?: string[],
): Promise<ReportTable> {
  const query = v.parse(transactionQuery, raw);
  const rows = await inSnapshot(db, (tx) =>
    tx.execute<TransactionRow>(sql`
      SELECT * FROM (${matching(orgId, query, scope)}) m
      WHERE ${query.status === "all" ? sql`true` : sql`m.status = ${query.status}`}
      ORDER BY m."occurredAt" DESC, m.id DESC LIMIT ${LIMIT + 1}`),
  );
  if (rows.rows.length > LIMIT)
    throw new ManagementError(
      "More than 50,000 transactions match. Narrow the range and export again.",
      400,
    );
  const t = (value: string | null): ReportCell => ({ kind: "text", value: value ?? "" });
  return {
    name: `transactions-${query.from}-${query.to}`,
    headers: [
      "Time",
      "Receipt",
      "Status",
      "Customer",
      "Items",
      "Tenders",
      "Cashier",
      "Total (GHS)",
    ],
    rows: rows.rows.map((row) => [
      t(new Date(row.occurredAt).toISOString()),
      t(row.receiptNumber ?? row.id),
      t(row.status),
      t(row.customerName),
      { kind: "count", value: row.items },
      t(row.tenders.join(" ")),
      t(row.cashierName),
      { kind: "money", value: Number(row.total) },
    ]),
  };
}
