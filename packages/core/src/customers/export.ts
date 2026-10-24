import { toDecimal } from "@shopper/money";
import { toCsv } from "@shopper/utils";
import type { Queryable } from "../types";
import { exportRows } from "./queries";

const header = [
  "Name",
  "Phone",
  "Kind",
  "Business name",
  "TIN",
  "Email",
  "Credit limit",
  "Balance",
  "Points",
];

/** Active customers as CSV, balance and credit limit in cedis and points folded from the ledgers. */
export async function customerCsv(db: Queryable, orgId: string) {
  const rows = await exportRows(db, orgId);
  return toCsv([
    header,
    ...rows.map((row) => [
      row.name,
      row.phone,
      row.kind,
      row.businessName ?? "",
      row.tin ?? "",
      row.email ?? "",
      toDecimal(row.creditLimit),
      toDecimal(row.balance),
      String(row.points),
    ]),
  ]);
}
